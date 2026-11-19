import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { getCampusConfig } from './src/lib/campusEligibility.ts';
import {
  resolveStoredPhotoPath,
  saveBase64ProfilePhoto,
  verifySignedPhotoToken,
} from './src/lib/photoStorage.ts';
import {
  AuthRequest,
  requireAuth,
  requireCompleteProfile,
  requireVerified,
} from './src/middleware/auth.ts';
import {
  AppQueryError,
  blockUser,
  createMatchMessage,
  deleteUserAccount,
  getActiveMatches,
  getDiscoverQueue,
  getMatchMessages,
  getMyFullProfile,
  getPhotoRecordById,
  getProfileRow,
  markMatchMessagesRead,
  recordLikeAndCheckMatch,
  recordPass,
  swapProfilePhotos,
  unmatchById,
  updateMyProfile,
  upsertProfilePhoto,
  verifyCampusAffiliation,
} from './src/db/queries.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Connected WebSocket clients indexed by Firebase UID
const userSockets = new Map<string, Set<WebSocket>>();

function registerSocket(uid: string, ws: WebSocket) {
  let set = userSockets.get(uid);
  if (!set) {
    set = new Set();
    userSockets.set(uid, set);
  }
  set.add(ws);
}

function unregisterSocket(uid: string, ws: WebSocket) {
  const set = userSockets.get(uid);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    userSockets.delete(uid);
  }
}

function emitToUser(uid: string, event: Record<string, unknown>) {
  const set = userSockets.get(uid);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function disconnectUserSockets(uid: string) {
  const set = userSockets.get(uid);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
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

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Real-time WebSocket server attached to port 3000 HTTP server
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let authenticatedUid: string | null = null;

    const authTimeout = setTimeout(() => {
      if (!authenticatedUid && ws.readyState === WebSocket.OPEN) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 10000);

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'auth' && typeof msg.token === 'string') {
          const decoded = await adminAuth.verifyIdToken(msg.token);
          const row = await getProfileRow(decoded.uid);
          if (!row || !row.isVerified || !row.isProfileComplete || !row.isActive) {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Profile ineligible' }));
            ws.close(4003, 'Profile ineligible');
            return;
          }
          if (authenticatedUid) {
            unregisterSocket(authenticatedUid, ws);
          }
          authenticatedUid = decoded.uid;
          clearTimeout(authTimeout);
          registerSocket(authenticatedUid, ws);
          ws.send(JSON.stringify({ type: 'auth:ok', uid: authenticatedUid }));
        } else if (msg?.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        ws.send(JSON.stringify({ type: 'auth:error', error: 'Invalid token' }));
        ws.close(4003, 'Unauthorized');
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (authenticatedUid) {
        unregisterSocket(authenticatedUid, ws);
      }
    });
  });

  // Safe HTTP security headers (iframe-compatible)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(express.json({ limit: '5mb' }));

  // Public configurable campus eligibility metadata
  app.get('/api/config/campus', (_req: Request, res: Response) => {
    res.json(getCampusConfig());
  });

  // Current authenticated user profile
  app.get('/api/me', requireAuth, async (req: AuthRequest, res: Response) => {
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

  // Permanently delete current authenticated user account and all associated data
  app.delete('/api/me', requireAuth, async (req: AuthRequest, res: Response) => {
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

      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'Could not delete account.');
    }
  });

  // Save college, branch, and year selection
  app.post('/api/auth/verify-campus', requireAuth, async (req: AuthRequest, res: Response) => {
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
  app.put(
    '/api/me/profile',
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

  // Upload or replace profile photo (slot 1 or 2)
  app.post(
    '/api/me/photos',
    requireAuth,
    requireVerified,
    async (req: AuthRequest, res: Response) => {
      try {
        const { displayOrder, dataUrl } = req.body || {};
        const slot = Number(displayOrder);
        if ((slot !== 1 && slot !== 2) || typeof dataUrl !== 'string') {
          return res.status(400).json({
            error: 'Valid photo slot (1 or 2) and image data are required.',
          });
        }

        const { storagePath, mimeType } = saveBase64ProfilePhoto(
          req.user!.uid,
          slot,
          dataUrl
        );
        const photo = await upsertProfilePhoto(
          req.user!.uid,
          slot,
          storagePath,
          mimeType
        );
        const profile = await getMyFullProfile(req.user!.uid);
        res.status(201).json({ photo, profile });
      } catch (error) {
        sendError(res, error, 'Photo upload failed.');
      }
    }
  );

  // Swap photo order (slot 1 <-> slot 2)
  app.post(
    '/api/me/photos/swap',
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
  app.get('/api/photos/:photoId', async (req: Request, res: Response) => {
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

    const filePath = resolveStoredPhotoPath(record.storagePath);
    if (!filePath) {
      return res.status(404).json({ error: 'Photo file unavailable.' });
    }

    res.setHeader('Content-Type', record.mimeType || 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  });

  // Discover eligible campus profiles
  app.get(
    '/api/discover',
    requireAuth,
    requireCompleteProfile,
    async (req: AuthRequest, res: Response) => {
      try {
        const profiles = await getDiscoverQueue(req.user!.uid);
        res.json({ profiles });
      } catch (error) {
        sendError(res, error, 'Failed to load discovery feed.');
      }
    }
  );

  // Like a profile (server-authoritative mutual match creation)
  app.post(
    '/api/discover/like',
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

  // Pass on a profile
  app.post(
    '/api/discover/pass',
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

  // List active mutual matches
  app.get(
    '/api/matches',
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
  app.get(
    '/api/matches/:matchId/messages',
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

  // Send a 1-on-1 text message (persisted in PostgreSQL + pushed via WebSocket)
  app.post(
    '/api/matches/:matchId/messages',
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

        res.status(201).json({ message });
      } catch (error) {
        sendError(res, error, 'Failed to send message.');
      }
    }
  );

  // Mark incoming messages in a match as read
  app.post(
    '/api/matches/:matchId/read',
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

  // Unmatch from a conversation
  app.post(
    '/api/matches/:matchId/unmatch',
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

  // Block another user (enforced bidirectionally across Discover, Likes, Matches, Chat)
  app.post(
    '/api/blocks',
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

  // Mount Vite middleware in development or static dist in production
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`NearU server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NearU server:', err);
  process.exit(1);
});
