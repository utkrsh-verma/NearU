import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { syncUserProfile, getProfileRow } from '../db/queries.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  profile?: Awaited<ReturnType<typeof syncUserProfile>>;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken.email) {
      return res.status(401).json({ error: 'Google account must provide an email address.' });
    }
    req.user = decodedToken;
    req.profile = await syncUserProfile(
      decodedToken.uid,
      decodedToken.email,
      decodedToken.name || null
    );
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
};

export const requireVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const profile = req.profile || (await getProfileRow(req.user.uid));
  if (!profile || !profile.isVerified) {
    return res.status(403).json({
      error: 'College verification required. Only verified GL Bajaj students can access NearU.',
      code: 'CAMPUS_VERIFICATION_REQUIRED',
    });
  }
  req.profile = profile;
  next();
};

export const requireCompleteProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const profile = req.profile || (await getProfileRow(req.user.uid));
  if (!profile || !profile.isVerified) {
    return res.status(403).json({
      error: 'College verification required.',
      code: 'CAMPUS_VERIFICATION_REQUIRED',
    });
  }
  if (!profile.isProfileComplete) {
    return res.status(403).json({
      error: 'Please complete your profile before discovering other students.',
      code: 'PROFILE_INCOMPLETE',
    });
  }
  req.profile = profile;
  next();
};
