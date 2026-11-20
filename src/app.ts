import express, { Request, Response } from 'express';
import { supabaseAdmin } from './lib/supabase-admin.ts';
import { getCampusConfig } from './lib/campusEligibility.ts';
import {
  createPublicStorageUrl,
  isLegacyDataUrl,
  verifyProfilePhotoObject,
  verifySignedPhotoToken,
} from './lib/photoStorage.ts';
import {
  AuthRequest,
  requireAuth,
  requireCompleteProfile,
  requireVerified,
} from './middleware/auth.ts';
import {
  AppQueryError,
  blockUser,
  createMatchMessage,
  deleteMatchMessage,
  deleteUserAccount,
  getActiveMatches,
  getDiscoverQueue,
  getReceivedLikes,
  getMatchMessages,
  getMyFullProfile,
  getPassedProfiles,
  getPhotoRecordById,
  markMatchMessagesRead,
  markMessageDelivered,
  recordLikeAndCheckMatch,
  recordPass,
  swapProfilePhotos,
  undoPass,
  unmatchById,
  updateMyProfile,
  upsertProfilePhoto,
  verifyCampusAffiliation,
} from './db/queries.ts';

// WebSocket connection registry (active when running with persistent server)
export const userSockets = new Map<string, Set<any>>();

export function registerSocket(uid: string, ws: any) {
  let set = userSockets.get(uid);
  if (!set) {
    set = new Set();
    userSockets.set(uid, set);
  }
  set.add(ws);
}

export function unregisterSocket(uid: string, ws: any) {
  const set = userSockets.get(uid);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    userSockets.delete(uid);
  }
}

export function emitToUser(uid: string, event: Record<string, unknown>) {
  const set = userSockets.get(uid);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === 1) { // 1 = OPEN
      ws.send(payload);
    }
  }
}

export function disconnectUserSockets(uid: string) {
  const set = userSockets.get(uid);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === 1 || ws.readyState === 0) {
      ws.close(4004, 'Account deleted');
    }
  }
  userSockets.delete(uid);
}

function sendError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof AppQueryError) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  }
  const msg = error instanceof Error ? error.message : fallbackMessage;
  return res.status(400).json({ error: msg || fallbackMessage });
}

function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Returns a normalised (trimmed, lower-case) UUID, or null if the value is not a valid UUID
function parseUserId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  return UUID_PATTERN.test(value) ? value : null;
}

export const app = express();

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '5mb' }));

const apiRouter = express.Router();

// Public campus eligibility metadata
apiRouter.get(['/config/campus', '/campus/config'], (_req: Request, res: Response) => {
  res.json(getCampusConfig());
});

// Current authenticated user profile
apiRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await getMyFullProfile(req.user!.uid);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json({ profile });
  } catch (error) {
    sendError(res, error, 'Failed to load profile.');
  }
});

// Permanently delete account
apiRouter.delete('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { affectedMatches } = await deleteUserAccount(uid);

    for (const item of affectedMatches) {
      emitToUser(item.partnerId, {
        type: 'match:removed',
        matchId: item.matchId,
      });
    }

    disconnectUserSockets(uid);

    try {
      await supabaseAdmin.auth.admin.deleteUser(uid);
    } catch (adminErr) {
      console.warn('Could not delete user from Supabase Auth admin:', adminErr);
    }

    res.json({ ok: true });
  } catch (error) {
    sendError(res, error, 'Could not delete account.');
  }
});

// Save college, branch, and year selection
apiRouter.post('/auth/verify-campus', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { college, branch, year } = req.body || {};
    if (
      typeof college !== 'string' ||
      typeof branch !== 'string' ||
      typeof year !== 'string'
    ) {
      return res.status(400).json({
        error: 'College, branch, and year are required.',
      });
    }

    await verifyCampusAffiliation(req.user!.uid, college, branch, year);
    const profile = await getMyFullProfile(req.user!.uid);
    res.json({ profile });
  } catch (error) {
    sendError(res, error, 'Could not save campus details.');
  }
});

// Update profile / complete onboarding
apiRouter.put(
  '/me/profile',
  requireAuth,
  requireVerified,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        fullName,
        dateOfBirth,
        gender,
        branch,
        batchYear,
        campusSpot,
        bio,
        lookingFor,
        interests,
        completeOnboarding,
      } = req.body || {};

      const profile = await updateMyProfile(req.user!.uid, {
        fullName: typeof fullName === 'string' ? fullName : undefined,
        dateOfBirth: typeof dateOfBirth === 'string' ? dateOfBirth : undefined,
        gender: typeof gender === 'string' ? gender : undefined,
        branch: typeof branch === 'string' ? branch : undefined,
        batchYear: typeof batchYear === 'string' ? batchYear : undefined,
        campusSpot: typeof campusSpot === 'string' ? campusSpot : undefined,
        bio: typeof bio === 'string' ? bio : undefined,
        lookingFor: typeof lookingFor === 'string' ? lookingFor : undefined,
        interests: Array.isArray(interests)
          ? interests.filter((i): i is string => typeof i === 'string')
          : undefined,
        completeOnboarding: Boolean(completeOnboarding),
      });

      res.json({ profile });
    } catch (error) {
      sendError(res, error, 'Failed to update profile.');
    }
  }
);

// Upload or replace profile photo
apiRouter.post(
  '/me/photos',
  requireAuth,
  requireVerified,
  async (req: AuthRequest, res: Response) => {
    try {
      const { displayOrder, storagePath } = req.body || {};
      const slot = Number(displayOrder);
      if ((slot !== 1 && slot !== 2) || typeof storagePath !== 'string') {
        return res.status(400).json({
          error: 'Valid photo slot (1 or 2) and storage path are required.',
        });
      }
      if (!(await verifyProfilePhotoObject(req.user!.uid, storagePath))) {
        return res.status(400).json({ error: 'Uploaded photo was not found or is not owned by this account.' });
      }
      const photo = await upsertProfilePhoto(
        req.user!.uid,
        slot,
        storagePath,
        'image/webp'
      );
      const profile = await getMyFullProfile(req.user!.uid);
      res.status(201).json({ photo, profile });
    } catch (error) {
      sendError(res, error, 'Photo upload failed.');
    }
  }
);

// Swap photo order
apiRouter.post(
  '/me/photos/swap',
  requireAuth,
  requireVerified,
  async (req: AuthRequest, res: Response) => {
    try {
      const photos = await swapProfilePhotos(req.user!.uid);
      const profile = await getMyFullProfile(req.user!.uid);
      res.json({ photos, profile });
    } catch (error) {
      sendError(res, error, 'Failed to reorder photos.');
    }
  }
);

// Serve signed private profile photos
apiRouter.get('/photos/:photoId', async (req: Request, res: Response) => {
  const photoId = parsePositiveInt(req.params.photoId);
  const exp = typeof req.query.exp === 'string' ? req.query.exp : undefined;
  const sig = typeof req.query.sig === 'string' ? req.query.sig : undefined;

  if (photoId === null || !verifySignedPhotoToken(photoId, exp, sig)) {
    return res.status(403).json({ error: 'Invalid or expired photo link.' });
  }

  const record = await getPhotoRecordById(photoId);
  if (!record) {
    return res.status(404).json({ error: 'Photo not found.' });
  }

  if (isLegacyDataUrl(record.storagePath)) {
    const match = record.storagePath.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mime = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mime || record.mimeType || 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      return res.end(buffer);
    }
  }

  return res.redirect(302, createPublicStorageUrl(record.storagePath));
});

// Discover queue
apiRouter.get(
  '/discover',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const gender = typeof req.query.gender === 'string' ? req.query.gender : 'all';
      if (gender !== 'all' && gender !== 'man' && gender !== 'woman') {
        return res.status(400).json({ error: 'Invalid gender filter.' });
      }
      const profiles = await getDiscoverQueue(req.user!.uid, gender);
      res.json({ profiles });
    } catch (error) {
      sendError(res, error, 'Failed to load discovery feed.');
    }
  }
);

// Like profile
apiRouter.post(
  '/discover/like',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const { targetUserId } = req.body || {};
      if (typeof targetUserId !== 'string' || !targetUserId.trim()) {
        return res.status(400).json({ error: 'Target profile ID is required.' });
      }

      const result = await recordLikeAndCheckMatch(
        req.user!.uid,
        targetUserId.trim()
      );

      if (result.matched && result.partnerMatchPayload) {
        emitToUser(targetUserId.trim(), {
          type: 'match:created',
          match: result.partnerMatchPayload,
        });
      } else {
        emitToUser(targetUserId.trim(), { type: 'likes:updated' });
      }

      res.json({
        matched: result.matched,
        match: result.match || null,
      });
    } catch (error) {
      sendError(res, error, 'Could not process like.');
    }
  }
);

// Received likes are resolved server-side so a user can only ever see their own list.
apiRouter.get('/likes/received', requireAuth, requireCompleteProfile, async (req: AuthRequest, res: Response) => {
  try {
    const profiles = await getReceivedLikes(req.user!.uid);
    res.json({ profiles, count: profiles.length });
  } catch (error) {
    sendError(res, error, 'Failed to load received likes.');
  }
});

// Pass profile
apiRouter.post(
  '/discover/pass',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const { targetUserId } = req.body || {};
      if (typeof targetUserId !== 'string' || !targetUserId.trim()) {
        return res.status(400).json({ error: 'Target profile ID is required.' });
      }

      await recordPass(req.user!.uid, targetUserId.trim());
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'Could not record pass.');
    }
  }
);

// Previously passed profiles (kept separate from the normal discover feed)
apiRouter.get(
  '/discover/passed',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const gender = typeof req.query.gender === 'string' ? req.query.gender : 'all';
      if (gender !== 'all' && gender !== 'man' && gender !== 'woman') {
        return res.status(400).json({ error: 'Invalid gender filter.' });
      }
      const profiles = await getPassedProfiles(req.user!.uid, gender);
      res.json({ profiles });
    } catch (error) {
      sendError(res, error, 'Failed to load passed profiles.');
    }
  }
);

// Undo a pass: removes the caller's own pass so the profile can appear in discovery again
apiRouter.post(
  '/discover/passed/undo',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const targetUserId = parseUserId(req.body?.targetUserId);
      if (!targetUserId) {
        return res.status(400).json({ error: 'A valid target profile ID is required.' });
      }

      const { removed } = await undoPass(req.user!.uid, targetUserId);
      res.json({ ok: true, removed });
    } catch (error) {
      sendError(res, error, 'Could not undo pass.');
    }
  }
);

// Like a previously passed profile (consumes the pass, then uses the normal like + match flow)
apiRouter.post(
  '/discover/passed/like',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const targetUserId = parseUserId(req.body?.targetUserId);
      if (!targetUserId) {
        return res.status(400).json({ error: 'A valid target profile ID is required.' });
      }

      const result = await recordLikeAndCheckMatch(req.user!.uid, targetUserId, {
        fromPassed: true,
      });

      if (result.matched && result.partnerMatchPayload) {
        emitToUser(targetUserId, {
          type: 'match:created',
          match: result.partnerMatchPayload,
        });
      }

      res.json({
        matched: result.matched,
        match: result.match || null,
      });
    } catch (error) {
      sendError(res, error, 'Could not process like.');
    }
  }
);

// List matches
apiRouter.get(
  '/matches',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const matches = await getActiveMatches(req.user!.uid);
      res.json({ matches });
    } catch (error) {
      sendError(res, error, 'Failed to load matches.');
    }
  }
);

// Get messages for a match
apiRouter.get(
  '/matches/:matchId/messages',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parsePositiveInt(req.params.matchId);
      if (matchId === null) {
        return res.status(400).json({ error: 'Invalid match ID.' });
      }

      const messages = await getMatchMessages(matchId, req.user!.uid);
      res.json({ messages });
    } catch (error) {
      sendError(res, error, 'Failed to load messages.');
    }
  }
);

// Send message
apiRouter.post(
  '/matches/:matchId/messages',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parsePositiveInt(req.params.matchId);
      const { content } = req.body || {};
      if (matchId === null || typeof content !== 'string') {
        return res
          .status(400)
          .json({ error: 'Valid match ID and message text are required.' });
      }

      const { message, partnerId } = await createMatchMessage(
        matchId,
        req.user!.uid,
        content
      );

      emitToUser(req.user!.uid, {
        type: 'message:created',
        matchId,
        message,
      });
      emitToUser(partnerId, {
        type: 'message:created',
        matchId,
        message,
      });

      // The message is delivered immediately when the recipient has an active session.
      if (userSockets.has(partnerId)) {
        await markMessageDelivered(message.id);
        message.deliveredAt = new Date().toISOString();
        emitToUser(req.user!.uid, { type: 'messages:delivered', matchId, messageId: message.id });
      }

      res.status(201).json({ message });
    } catch (error) {
      sendError(res, error, 'Failed to send message.');
    }
  }
);

apiRouter.delete('/messages/:messageId', requireAuth, requireCompleteProfile, async (req: AuthRequest, res: Response) => {
  try {
    const messageId = parsePositiveInt(req.params.messageId);
    if (messageId === null) return res.status(400).json({ error: 'Invalid message ID.' });
    const result = await deleteMatchMessage(messageId, req.user!.uid);
    const event = { type: 'message:deleted', matchId: result.matchId, messageId };
    emitToUser(req.user!.uid, event);
    emitToUser(result.partnerId, event);
    res.json({ ok: true, matchId: result.matchId });
  } catch (error) {
    sendError(res, error, 'Could not delete this message.');
  }
});

// Mark read
apiRouter.post(
  '/matches/:matchId/read',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parsePositiveInt(req.params.matchId);
      if (matchId === null) {
        return res.status(400).json({ error: 'Invalid match ID.' });
      }

      const result = await markMatchMessagesRead(matchId, req.user!.uid);
      if (result) {
        emitToUser(result.partnerId, {
          type: 'messages:read',
          matchId,
          readerId: req.user!.uid,
          readAt: result.readAt,
        });
      }
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'Could not update read status.');
    }
  }
);

// Unmatch
apiRouter.post(
  '/matches/:matchId/unmatch',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const matchId = parsePositiveInt(req.params.matchId);
      if (matchId === null) {
        return res.status(400).json({ error: 'Invalid match ID.' });
      }

      const { user1Id, user2Id } = await unmatchById(matchId, req.user!.uid);
      emitToUser(user1Id, { type: 'match:removed', matchId });
      emitToUser(user2Id, { type: 'match:removed', matchId });
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'Could not unmatch.');
    }
  }
);

// Block user
apiRouter.post(
  '/blocks',
  requireAuth,
  requireCompleteProfile,
  async (req: AuthRequest, res: Response) => {
    try {
      const { targetUserId, reason } = req.body || {};
      if (typeof targetUserId !== 'string' || !targetUserId.trim()) {
        return res.status(400).json({ error: 'Target user ID is required.' });
      }

      const blockedId = targetUserId.trim();
      const { affectedMatchIds } = await blockUser(
        req.user!.uid,
        blockedId,
        typeof reason === 'string' ? reason : undefined
      );

      for (const matchId of affectedMatchIds) {
        emitToUser(req.user!.uid, { type: 'match:removed', matchId });
        emitToUser(blockedId, { type: 'match:removed', matchId });
      }

      res.json({ ok: true, affectedMatchIds });
    } catch (error) {
      sendError(res, error, 'Could not block user.');
    }
  }
);

// Mount router at both /api and root so both /api/me and /me resolve correctly
app.use('/api', apiRouter);
app.use('/', apiRouter);
