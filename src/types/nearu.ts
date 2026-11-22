export interface CampusConfig {
  campusName: string;
  campusShortName: string;
  allowedDomains: string[];
  allowAnyGoogleSignIn: boolean;
  allowRollCodeVerification: boolean;
  institutionalEmailRequired: boolean;
  minAge: number;
}

export interface ProfilePhoto {
  id: number;
  displayOrder: number;
  url: string;
}

export interface PublicProfile {
  id: string;
  fullName: string;
  age: number | null;
  gender: string | null;
  branch: string | null;
  batchYear: string | null;
  campusSpot: string | null;
  bio: string | null;
  lookingFor: string | null;
  interests: string[];
  isVerified: boolean;
  photos: ProfilePhoto[];
  sharedInterests?: string[];
}

export interface PassedProfile extends PublicProfile {
  passedAt: string;
}

export interface MyProfile extends PublicProfile {
  email: string;
  collegeEmail: string | null;
  rollNumber: string | null;
  verificationMethod: string | null;
  dateOfBirth: string | null;
  isProfileComplete: boolean;
  isActive: boolean;
  blockedCount: number;
}

export interface ChatMessage {
  id: number;
  matchId: number;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  deliveredAt: string | null;
  deletedAt: string | null;
}

export interface MatchSummary {
  id: number;
  createdAt: string;
  updatedAt: string;
  partner: PublicProfile;
  sharedInterests: string[];
  lastMessage: {
    id: number;
    senderId: string;
    content: string;
    createdAt: string;
    readAt: string | null;
  } | null;
  unreadCount: number;
}

export type AppTab = 'discover' | 'likes' | 'matches' | 'profile';
