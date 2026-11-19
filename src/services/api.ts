import { auth } from '../lib/firebase';
import {
  CampusConfig,
  ChatMessage,
  MatchSummary,
  MyProfile,
  ProfilePhoto,
  PublicProfile,
} from '../types/nearu';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function getBearerToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError('Please sign in to continue.', 401);
  }
  return await user.getIdToken();
}

async function request<T>(
  url: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (authenticated) {
    const token = await getBearerToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(
      'Network error. Please check your internet connection and try again.',
      0
    );
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Request failed (${res.status}).`,
      res.status,
      data?.code
    );
  }

  return data as T;
}

export const api = {
  getCampusConfig: () => request<CampusConfig>('/api/config/campus', {}, false),

  getMe: () => request<{ profile: MyProfile }>('/api/me'),

  deleteAccount: () => request<{ ok: boolean }>('/api/me', { method: 'DELETE' }),

  verifyCampus: (payload: {
    college: string;
    branch: string;
    year: string;
  }) =>
    request<{ profile: MyProfile }>('/api/auth/verify-campus', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProfile: (payload: {
    fullName?: string;
    dateOfBirth?: string;
    gender?: string;
    branch?: string;
    batchYear?: string;
    campusSpot?: string;
    bio?: string;
    lookingFor?: string;
    interests?: string[];
    completeOnboarding?: boolean;
  }) =>
    request<{ profile: MyProfile }>('/api/me/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  uploadPhoto: (displayOrder: 1 | 2, dataUrl: string) =>
    request<{ photo: ProfilePhoto; profile: MyProfile }>('/api/me/photos', {
      method: 'POST',
      body: JSON.stringify({ displayOrder, dataUrl }),
    }),

  swapPhotos: () =>
    request<{ photos: ProfilePhoto[]; profile: MyProfile }>('/api/me/photos/swap', {
      method: 'POST',
    }),

  getDiscoverQueue: () =>
    request<{ profiles: PublicProfile[] }>('/api/discover'),

  likeProfile: (targetUserId: string) =>
    request<{ matched: boolean; match: MatchSummary | null }>('/api/discover/like', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  passProfile: (targetUserId: string) =>
    request<{ ok: boolean }>('/api/discover/pass', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  getMatches: () => request<{ matches: MatchSummary[] }>('/api/matches'),

  getMessages: (matchId: number) =>
    request<{ messages: ChatMessage[] }>(`/api/matches/${matchId}/messages`),

  sendMessage: (matchId: number, content: string) =>
    request<{ message: ChatMessage }>(`/api/matches/${matchId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  markRead: (matchId: number) =>
    request<{ ok: boolean }>(`/api/matches/${matchId}/read`, {
      method: 'POST',
    }),

  unmatch: (matchId: number) =>
    request<{ ok: boolean }>(`/api/matches/${matchId}/unmatch`, {
      method: 'POST',
    }),

  blockUser: (targetUserId: string, reason?: string) =>
    request<{ ok: boolean; affectedMatchIds: number[] }>('/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason }),
    }),
};
