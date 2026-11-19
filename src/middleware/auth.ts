import { Request, Response, NextFunction } from 'express';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase-admin.ts';
import { syncUserProfile, getProfileRow } from '../db/queries.ts';

export interface AuthUser {
  uid: string;
  id: string;
  email: string;
  name?: string | null;
  rawUser?: SupabaseUser;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
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
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('Supabase auth verification failed:', error);
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    if (!user.email) {
      return res.status(401).json({ error: 'User account must provide an email address.' });
    }

    const authUser: AuthUser = {
      uid: user.id,
      id: user.id,
      email: user.email,
      name:
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        null,
      rawUser: user,
    };

    req.user = authUser;
    req.profile = await syncUserProfile(
      authUser.uid,
      authUser.email,
      authUser.name || null
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
