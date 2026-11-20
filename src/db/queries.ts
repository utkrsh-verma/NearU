import { and, asc, desc, eq, inArray, isNull, ne, notInArray, or } from 'drizzle-orm';
import { db } from './index.ts';
import {
  blocks,
  campusAccessCodes,
  likes,
  matches,
  messages,
  passes,
  profilePhotos,
  profiles,
} from './schema.ts';
import {
  calculateAgeFromDob,
  getCampusConfig,
  isAllowedCollegeEmail,
  isValidRollNumber,
  validateMinimumAge,
} from '../lib/campusEligibility.ts';
import {
  createPublicStorageUrl,
  createSignedPhotoUrl,
  deleteStoredPhotoFile,
  isLegacyDataUrl,
} from '../lib/photoStorage.ts';

export class AppQueryError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface PublicPhotoDTO {
  id: number;
  displayOrder: number;
  url: string;
}

export interface PublicProfileDTO {
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
  photos: PublicPhotoDTO[];
  sharedInterests?: string[];
}

export interface MyProfileDTO extends PublicProfileDTO {
  email: string;
  collegeEmail: string | null;
  rollNumber: string | null;
  verificationMethod: string | null;
  dateOfBirth: string | null;
  isProfileComplete: boolean;
  isActive: boolean;
  blockedCount: number;
}

export interface MatchDTO {
  id: number;
  createdAt: string;
  updatedAt: string;
  partner: PublicProfileDTO;
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

export interface MessageDTO {
  id: number;
  matchId: number;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function formatPhoto(row: typeof profilePhotos.$inferSelect): PublicPhotoDTO {
  return {
    id: row.id,
    displayOrder: row.displayOrder,
    // Legacy Data URLs remain available during migration; new paths resolve via the CDN.
    url: isLegacyDataUrl(row.storagePath)
      ? createSignedPhotoUrl(row.id)
      : createPublicStorageUrl(row.storagePath),
  };
}

function toPublicProfile(
  row: typeof profiles.$inferSelect,
  photoRows: (typeof profilePhotos.$inferSelect)[],
  viewerInterests: string[] = []
): PublicProfileDTO {
  const sortedPhotos = [...photoRows]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(formatPhoto);

  const userInterests = Array.isArray(row.interests) ? row.interests : [];
  const viewerSet = new Set(viewerInterests.map((i) => i.toLowerCase()));
  const shared = userInterests.filter((i) => viewerSet.has(i.toLowerCase()));

  return {
    id: row.id,
    fullName: row.fullName || '',
    age: row.dateOfBirth ? calculateAgeFromDob(row.dateOfBirth) : null,
    gender: row.gender,
    branch: row.branch,
    batchYear: row.batchYear,
    campusSpot: row.campusSpot,
    bio: row.bio,
    lookingFor: row.lookingFor,
    interests: userInterests,
    isVerified: row.isVerified,
    photos: sortedPhotos,
    sharedInterests: shared,
  };
}

export async function getProfileRow(uid: string) {
  try {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, uid))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed (getProfileRow):', error);
    throw new AppQueryError(
      'Unable to load account details. Please try again.',
      500
    );
  }
}

export async function syncUserProfile(
  uid: string,
  email: string,
  googleDisplayName: string | null
) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const autoVerified = isAllowedCollegeEmail(normalizedEmail);

    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, uid))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const shouldUpgradeVerification = autoVerified && !current.isVerified;
      const updated = await db
        .update(profiles)
        .set({
          email: normalizedEmail,
          ...(shouldUpgradeVerification
            ? {
                isVerified: true,
                collegeEmail: normalizedEmail,
                verificationMethod: 'domain_email',
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, uid))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(profiles)
      .values({
        id: uid,
        email: normalizedEmail,
        collegeEmail: autoVerified ? normalizedEmail : null,
        verificationMethod: autoVerified ? 'domain_email' : null,
        isVerified: autoVerified,
        isProfileComplete: false,
        isActive: true,
        fullName: googleDisplayName ? googleDisplayName.trim().slice(0, 60) : null,
        interests: [],
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: normalizedEmail,
          updatedAt: new Date(),
        },
      })
      .returning();

    return inserted[0];
  } catch (error: any) {
    const cause = error?.cause?.message ? ` - ${error.cause.message}` : '';
    console.error('Database query failed (syncUserProfile):', error, cause);
    throw new AppQueryError(
      `Database error: ${error?.message || 'Connection failed'}${cause}`,
      500
    );
  }
}

const ALLOWED_COLLEGES = new Set([
  'GL Bajaj Institute of Technology & Management',
]);

export async function verifyCampusAffiliation(
  uid: string,
  collegeRaw: string,
  branchRaw: string,
  yearRaw: string
) {
  const college = collegeRaw.trim();
  const branch = branchRaw.trim();
  const year = yearRaw.trim();

  if (!college || !ALLOWED_COLLEGES.has(college)) {
    throw new AppQueryError('Please select a valid college from the list.', 400);
  }

  if (!branch || branch.length > 80) {
    throw new AppQueryError('Please select your branch.', 400);
  }

  if (!year || year.length > 40) {
    throw new AppQueryError('Please select your year.', 400);
  }

  try {
    const updated = await db
      .update(profiles)
      .set({
        branch,
        batchYear: year,
        verificationMethod: 'campus_invite',
        isVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, uid))
      .returning();

    return updated[0];
  } catch (error: any) {
    if (error instanceof AppQueryError) throw error;
    console.error('Database query failed (verifyCampusAffiliation):', error);
    throw new AppQueryError(
      `Could not save your campus details: ${error?.message || 'Database error'}`,
      500
    );
  }
}

export async function getMyFullProfile(uid: string): Promise<MyProfileDTO | null> {
  try {
    const [profileRows, photoRows, blockRows] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, uid)).limit(1),
      db
        .select()
        .from(profilePhotos)
        .where(eq(profilePhotos.userId, uid))
        .orderBy(asc(profilePhotos.displayOrder)),
      db.select({ id: blocks.id }).from(blocks).where(eq(blocks.blockerId, uid)),
    ]);

    if (profileRows.length === 0) return null;
    const row = profileRows[0];
    const pub = toPublicProfile(row, photoRows);

    return {
      ...pub,
      email: row.email,
      collegeEmail: row.collegeEmail,
      rollNumber: row.rollNumber,
      verificationMethod: row.verificationMethod,
      dateOfBirth: row.dateOfBirth,
      isProfileComplete: row.isProfileComplete,
      isActive: row.isActive,
      blockedCount: blockRows.length,
    };
  } catch (error) {
    console.error('Database query failed (getMyFullProfile):', error);
    throw new AppQueryError('Could not load your profile. Please refresh.', 500);
  }
}

export interface ProfileUpdateInput {
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
}

export async function updateMyProfile(uid: string, input: ProfileUpdateInput) {
  const existing = await getProfileRow(uid);
  if (!existing) {
    throw new AppQueryError('Profile not found.', 404);
  }

  const nextFullName =
    input.fullName !== undefined ? input.fullName.trim() : existing.fullName || '';
  const nextDob =
    input.dateOfBirth !== undefined
      ? input.dateOfBirth.trim()
      : existing.dateOfBirth || '';
  const nextGender =
    input.gender !== undefined ? input.gender.trim() : existing.gender || '';
  const nextBranch =
    input.branch !== undefined ? input.branch.trim() : existing.branch || '';
  const nextBatchYear =
    input.batchYear !== undefined ? input.batchYear.trim() : existing.batchYear || '';
  const nextCampusSpot =
    input.campusSpot !== undefined
      ? input.campusSpot.trim().slice(0, 60)
      : existing.campusSpot || '';
  const nextBio =
    input.bio !== undefined ? input.bio.trim() : existing.bio || '';
  const nextLookingFor =
    input.lookingFor !== undefined
      ? input.lookingFor.trim()
      : existing.lookingFor || '';
  const nextInterests =
    input.interests !== undefined
      ? Array.from(
          new Set(
            input.interests
              .map((i) => i.trim())
              .filter(Boolean)
              .slice(0, 5)
          )
        )
      : Array.isArray(existing.interests)
        ? existing.interests
        : [];

  if (
    input.fullName !== undefined &&
    (nextFullName.length < 2 || nextFullName.length > 60)
  ) {
    throw new AppQueryError('Full name must be between 2 and 60 characters.', 400);
  }

  if (input.dateOfBirth !== undefined || input.completeOnboarding) {
    const ageCheck = validateMinimumAge(nextDob);
    if (!ageCheck.valid) {
      throw new AppQueryError(
        ageCheck.error || 'You must be 18 or older to use NearU.',
        400
      );
    }
  }

  if (nextBio.length > 180) {
    throw new AppQueryError('Bio must be 180 characters or fewer.', 400);
  }

  // Enforce complete required fields both on onboarding completion AND edits to completed profiles
  const mustSatisfyFullProfile =
    Boolean(input.completeOnboarding) || existing.isProfileComplete;

  if (mustSatisfyFullProfile) {
    if (!nextFullName || nextFullName.length < 2) {
      throw new AppQueryError('Full name is required.', 400);
    }
    const ageCheck = validateMinimumAge(nextDob);
    if (!ageCheck.valid) {
      throw new AppQueryError(
        ageCheck.error || 'You must be 18 or older to use NearU.',
        400
      );
    }
    if (!nextGender) {
      throw new AppQueryError('Please select your gender.', 400);
    }
    if (!nextBranch || !nextBatchYear) {
      throw new AppQueryError('Please select your branch and batch year.', 400);
    }
    if (!nextLookingFor) {
      throw new AppQueryError('Please select what you are looking for.', 400);
    }
  }

  try {
    let shouldMarkComplete = existing.isProfileComplete;

    if (input.completeOnboarding) {
      shouldMarkComplete = true;
    }

    await db
      .update(profiles)
      .set({
        fullName: nextFullName || null,
        dateOfBirth: nextDob || null,
        gender: nextGender || null,
        branch: nextBranch || null,
        batchYear: nextBatchYear || null,
        campusSpot: nextCampusSpot || null,
        bio: nextBio || null,
        lookingFor: nextLookingFor || null,
        interests: nextInterests,
        isProfileComplete: shouldMarkComplete,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, uid));

    return await getMyFullProfile(uid);
  } catch (error: any) {
    if (error instanceof AppQueryError) throw error;
    console.error('Database query failed (updateMyProfile):', error);
    throw new AppQueryError(
      `Could not save profile changes: ${error?.message || 'Database error'}`,
      500
    );
  }
}

export async function upsertProfilePhoto(
  uid: string,
  displayOrder: number,
  storagePath: string,
  mimeType: string
): Promise<PublicPhotoDTO> {
  if (displayOrder !== 1 && displayOrder !== 2) {
    throw new AppQueryError('Photo slot must be 1 or 2.', 400);
  }

  try {
    const existing = await db
      .select()
      .from(profilePhotos)
      .where(
        and(
          eq(profilePhotos.userId, uid),
          eq(profilePhotos.displayOrder, displayOrder)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const oldPath = existing[0].storagePath;
      const updated = await db
        .update(profilePhotos)
        .set({ storagePath, mimeType, createdAt: new Date() })
        .where(eq(profilePhotos.id, existing[0].id))
        .returning();
      await deleteStoredPhotoFile(oldPath);
      return formatPhoto(updated[0]);
    }

    const inserted = await db
      .insert(profilePhotos)
      .values({
        userId: uid,
        storagePath,
        mimeType,
        displayOrder,
      })
      .returning();

    return formatPhoto(inserted[0]);
  } catch (error) {
    console.error('Database query failed (upsertProfilePhoto):', error);
    throw new AppQueryError('Could not save your photo. Please try again.', 500);
  }
}

export async function swapProfilePhotos(uid: string): Promise<PublicPhotoDTO[]> {
  try {
    const existing = await db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.userId, uid))
      .orderBy(asc(profilePhotos.displayOrder));

    if (existing.length < 2) {
      return existing.map(formatPhoto);
    }

    const [first, second] = existing;

    await db.transaction(async (tx) => {
      await tx
        .update(profilePhotos)
        .set({ displayOrder: 99 })
        .where(eq(profilePhotos.id, first.id));
      await tx
        .update(profilePhotos)
        .set({ displayOrder: 1 })
        .where(eq(profilePhotos.id, second.id));
      await tx
        .update(profilePhotos)
        .set({ displayOrder: 2 })
        .where(eq(profilePhotos.id, first.id));
    });

    const refreshed = await db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.userId, uid))
      .orderBy(asc(profilePhotos.displayOrder));

    return refreshed.map(formatPhoto);
  } catch (error) {
    console.error('Database query failed (swapProfilePhotos):', error);
    throw new AppQueryError('Could not reorder photos right now.', 500);
  }
}

export async function getPhotoRecordById(photoId: number) {
  try {
    const rows = await db
      .select()
      .from(profilePhotos)
      .where(eq(profilePhotos.id, photoId))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed (getPhotoRecordById):', error);
    return null;
  }
}

export async function hasBlockBetween(userA: string, userB: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, userA), eq(blocks.blockedId, userB)),
          and(eq(blocks.blockerId, userB), eq(blocks.blockedId, userA))
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error('Database query failed (hasBlockBetween):', error);
    throw new AppQueryError('Security check failed. Please retry.', 500);
  }
}

export type DiscoverGenderFilter = 'all' | 'man' | 'woman';

export async function getDiscoverQueue(
  uid: string,
  genderFilter: DiscoverGenderFilter = 'all'
): Promise<PublicProfileDTO[]> {
  try {
    const [meRows, likedRows, passedRows, blockRows, matchRows] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, uid)).limit(1),
      db.select({ target: likes.likedId }).from(likes).where(eq(likes.likerId, uid)),
      db.select({ target: passes.passedId }).from(passes).where(eq(passes.passerId, uid)),
      db
        .select({ blocker: blocks.blockerId, blocked: blocks.blockedId })
        .from(blocks)
        .where(or(eq(blocks.blockerId, uid), eq(blocks.blockedId, uid))),
      db
        .select({ user1: matches.user1Id, user2: matches.user2Id })
        .from(matches)
        .where(or(eq(matches.user1Id, uid), eq(matches.user2Id, uid))),
    ]);

    const me = meRows[0];
    const myInterests = Array.isArray(me?.interests) ? me.interests : [];

    const excluded = new Set<string>([uid]);
    for (const r of likedRows) excluded.add(r.target);
    for (const r of passedRows) excluded.add(r.target);
    for (const r of blockRows) {
      excluded.add(r.blocker);
      excluded.add(r.blocked);
    }
    for (const r of matchRows) {
      excluded.add(r.user1);
      excluded.add(r.user2);
    }

    const excludedList = Array.from(excluded);

    // Filter excluded IDs inside PostgreSQL BEFORE applying LIMIT so large campuses never starve
    const genderCondition =
      genderFilter === 'man'
        ? eq(profiles.gender, 'Man')
        : genderFilter === 'woman'
          ? eq(profiles.gender, 'Woman')
          : undefined;

    const candidates = await db
      .select()
      .from(profiles)
      .where(
        and(
          eq(profiles.isVerified, true),
          eq(profiles.isProfileComplete, true),
          eq(profiles.isActive, true),
          notInArray(profiles.id, excludedList),
          genderCondition
        )
      )
      .orderBy(desc(profiles.updatedAt))
      .limit(50);

    if (candidates.length === 0) return [];

    const candidateIds = candidates.map((c) => c.id);
    const allPhotos = await db
      .select()
      .from(profilePhotos)
      .where(inArray(profilePhotos.userId, candidateIds))
      .orderBy(asc(profilePhotos.displayOrder));

    const photosByUser = new Map<string, (typeof profilePhotos.$inferSelect)[]>();
    for (const photo of allPhotos) {
      const list = photosByUser.get(photo.userId) || [];
      list.push(photo);
      photosByUser.set(photo.userId, list);
    }

    const formatted = candidates
      .filter((c) => {
        const age = c.dateOfBirth ? calculateAgeFromDob(c.dateOfBirth) : null;
        return age !== null && age >= 18;
      })
      .map((c) => toPublicProfile(c, photosByUser.get(c.id) || [], myInterests));

    formatted.sort(
      (a, b) => (b.sharedInterests?.length || 0) - (a.sharedInterests?.length || 0)
    );

    return formatted;
  } catch (error) {
    console.error('Database query failed (getDiscoverQueue):', error);
    throw new AppQueryError(
      'Unable to load campus profiles right now. Please try again.',
      500
    );
  }
}

/** Profiles that liked the current user and have not been reciprocated or matched. */
export async function getReceivedLikes(uid: string): Promise<PublicProfileDTO[]> {
  try {
    const [meRows, incomingRows, outgoingRows, blockRows, matchRows] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, uid)).limit(1),
      db.select({ likerId: likes.likerId, createdAt: likes.createdAt })
        .from(likes).where(eq(likes.likedId, uid)).orderBy(desc(likes.createdAt)),
      db.select({ likedId: likes.likedId }).from(likes).where(eq(likes.likerId, uid)),
      db.select({ blocker: blocks.blockerId, blocked: blocks.blockedId })
        .from(blocks).where(or(eq(blocks.blockerId, uid), eq(blocks.blockedId, uid))),
      db.select({ user1: matches.user1Id, user2: matches.user2Id })
        .from(matches).where(or(eq(matches.user1Id, uid), eq(matches.user2Id, uid))),
    ]);

    const excluded = new Set<string>(outgoingRows.map((row) => row.likedId));
    for (const row of blockRows) {
      excluded.add(row.blocker);
      excluded.add(row.blocked);
    }
    for (const row of matchRows) {
      excluded.add(row.user1);
      excluded.add(row.user2);
    }
    excluded.add(uid);

    const likerIds = incomingRows.map((row) => row.likerId).filter((id) => !excluded.has(id));
    if (likerIds.length === 0) return [];

    const [likerProfiles, photos] = await Promise.all([
      db.select().from(profiles).where(and(
        inArray(profiles.id, likerIds),
        eq(profiles.isVerified, true),
        eq(profiles.isProfileComplete, true),
        eq(profiles.isActive, true)
      )),
      db.select().from(profilePhotos).where(inArray(profilePhotos.userId, likerIds))
        .orderBy(asc(profilePhotos.displayOrder)),
    ]);
    const photosByUser = new Map<string, (typeof profilePhotos.$inferSelect)[]>();
    for (const photo of photos) {
      const list = photosByUser.get(photo.userId) || [];
      list.push(photo);
      photosByUser.set(photo.userId, list);
    }
    const myInterests = Array.isArray(meRows[0]?.interests) ? meRows[0].interests : [];
    const position = new Map(incomingRows.map((row, index) => [row.likerId, index]));
    return likerProfiles
      .filter((profile) => {
        const age = profile.dateOfBirth ? calculateAgeFromDob(profile.dateOfBirth) : null;
        return age !== null && age >= 18;
      })
      .map((profile) => toPublicProfile(profile, photosByUser.get(profile.id) || [], myInterests))
      .sort((a, b) => (position.get(a.id) || 0) - (position.get(b.id) || 0));
  } catch (error) {
    console.error('Database query failed (getReceivedLikes):', error);
    throw new AppQueryError('Unable to load likes right now. Please try again.', 500);
  }
}

export async function recordLikeAndCheckMatch(
  likerId: string,
  likedId: string
): Promise<{
  matched: boolean;
  match?: MatchDTO;
  partnerMatchPayload?: MatchDTO;
}> {
  if (likerId === likedId) {
    throw new AppQueryError('You cannot like your own profile.', 400);
  }

  if (await hasBlockBetween(likerId, likedId)) {
    throw new AppQueryError(
      'This profile is no longer available.',
      410,
      'PROFILE_UNAVAILABLE'
    );
  }

  try {
    const targetRows = await db
      .select()
      .from(profiles)
      .where(
        and(
          eq(profiles.id, likedId),
          eq(profiles.isVerified, true),
          eq(profiles.isProfileComplete, true),
          eq(profiles.isActive, true)
        )
      )
      .limit(1);

    if (targetRows.length === 0) {
      throw new AppQueryError(
        'This profile is no longer available.',
        410,
        'PROFILE_UNAVAILABLE'
      );
    }

    const matchRecord = await db.transaction(async (tx) => {
      await tx
        .insert(likes)
        .values({ likerId, likedId })
        .onConflictDoNothing({ target: [likes.likerId, likes.likedId] });

      const reciprocal = await tx
        .select()
        .from(likes)
        .where(and(eq(likes.likerId, likedId), eq(likes.likedId, likerId)))
        .limit(1);

      if (reciprocal.length === 0) {
        return null;
      }

      const [user1Id, user2Id] = canonicalPair(likerId, likedId);
      const existingMatch = await tx
        .select()
        .from(matches)
        .where(and(eq(matches.user1Id, user1Id), eq(matches.user2Id, user2Id)))
        .limit(1);

      if (existingMatch.length > 0) {
        if (existingMatch[0].status !== 'active') return null;
        return existingMatch[0];
      }

      const created = await tx
        .insert(matches)
        .values({
          user1Id,
          user2Id,
          status: 'active',
        })
        .onConflictDoNothing({ target: [matches.user1Id, matches.user2Id] })
        .returning();

      if (created.length > 0) return created[0];

      const fallback = await tx
        .select()
        .from(matches)
        .where(and(eq(matches.user1Id, user1Id), eq(matches.user2Id, user2Id)))
        .limit(1);
      return fallback[0] || null;
    });

    if (!matchRecord || matchRecord.status !== 'active') {
      return { matched: false };
    }

    const [likerMatch, partnerMatch] = await Promise.all([
      getSingleMatchForUser(matchRecord.id, likerId),
      getSingleMatchForUser(matchRecord.id, likedId),
    ]);

    return {
      matched: true,
      match: likerMatch || undefined,
      partnerMatchPayload: partnerMatch || undefined,
    };
  } catch (error: any) {
    if (error instanceof AppQueryError) throw error;
    console.error('Database query failed (recordLikeAndCheckMatch):', error);
    throw new AppQueryError(
      'Could not process your like. Please try again.',
      500
    );
  }
}

export async function recordPass(passerId: string, passedId: string): Promise<void> {
  if (passerId === passedId) {
    throw new AppQueryError('You cannot pass on your own profile.', 400);
  }

  if (await hasBlockBetween(passerId, passedId)) {
    throw new AppQueryError(
      'This profile is no longer available.',
      410,
      'PROFILE_UNAVAILABLE'
    );
  }

  try {
    const targetRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.id, passedId), eq(profiles.isActive, true)))
      .limit(1);

    if (targetRows.length === 0) {
      throw new AppQueryError(
        'This profile is no longer available.',
        410,
        'PROFILE_UNAVAILABLE'
      );
    }

    await db
      .insert(passes)
      .values({ passerId, passedId })
      .onConflictDoNothing({ target: [passes.passerId, passes.passedId] });
  } catch (error: any) {
    if (error instanceof AppQueryError) throw error;
    console.error('Database query failed (recordPass):', error);
    throw new AppQueryError('Could not record pass. Please try again.', 500);
  }
}

export async function getSingleMatchForUser(
  matchId: number,
  uid: string
): Promise<MatchDTO | null> {
  const list = await getActiveMatches(uid, matchId);
  return list[0] || null;
}

export async function getActiveMatches(
  uid: string,
  filterMatchId?: number
): Promise<MatchDTO[]> {
  try {
    const conditions = [
      eq(matches.status, 'active'),
      or(eq(matches.user1Id, uid), eq(matches.user2Id, uid)),
    ];
    if (filterMatchId !== undefined) {
      conditions.push(eq(matches.id, filterMatchId));
    }

    const [myRows, matchRows, blockRows] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, uid)).limit(1),
      db
        .select()
        .from(matches)
        .where(and(...conditions))
        .orderBy(desc(matches.updatedAt)),
      db
        .select({ blocker: blocks.blockerId, blocked: blocks.blockedId })
        .from(blocks)
        .where(or(eq(blocks.blockerId, uid), eq(blocks.blockedId, uid))),
    ]);

    const blockedSet = new Set<string>();
    for (const b of blockRows) {
      blockedSet.add(b.blocker === uid ? b.blocked : b.blocker);
    }

    const validMatches = matchRows.filter((m) => {
      const partnerId = m.user1Id === uid ? m.user2Id : m.user1Id;
      return !blockedSet.has(partnerId);
    });

    if (validMatches.length === 0) return [];

    const partnerIds = validMatches.map((m) =>
      m.user1Id === uid ? m.user2Id : m.user1Id
    );
    const matchIds = validMatches.map((m) => m.id);

    const [partnerProfiles, partnerPhotos, recentMessages] = await Promise.all([
      db.select().from(profiles).where(inArray(profiles.id, partnerIds)),
      db
        .select()
        .from(profilePhotos)
        .where(inArray(profilePhotos.userId, partnerIds))
        .orderBy(asc(profilePhotos.displayOrder)),
      db
        .select()
        .from(messages)
        .where(inArray(messages.matchId, matchIds))
        .orderBy(desc(messages.createdAt)),
    ]);

    const profileMap = new Map(partnerProfiles.map((p) => [p.id, p]));
    const photosMap = new Map<string, (typeof profilePhotos.$inferSelect)[]>();
    for (const photo of partnerPhotos) {
      const arr = photosMap.get(photo.userId) || [];
      arr.push(photo);
      photosMap.set(photo.userId, arr);
    }

    const lastMessageByMatch = new Map<number, typeof messages.$inferSelect>();
    const unreadCountByMatch = new Map<number, number>();
    for (const msg of recentMessages) {
      if (!lastMessageByMatch.has(msg.matchId)) {
        lastMessageByMatch.set(msg.matchId, msg);
      }
      if (msg.senderId !== uid && !msg.readAt) {
        unreadCountByMatch.set(
          msg.matchId,
          (unreadCountByMatch.get(msg.matchId) || 0) + 1
        );
      }
    }

    const myInterests = Array.isArray(myRows[0]?.interests) ? myRows[0].interests : [];

    const results: MatchDTO[] = [];
    for (const m of validMatches) {
      const partnerId = m.user1Id === uid ? m.user2Id : m.user1Id;
      const partnerRow = profileMap.get(partnerId);
      if (!partnerRow || !partnerRow.isActive) continue;

      const partner = toPublicProfile(
        partnerRow,
        photosMap.get(partnerId) || [],
        myInterests
      );
      const last = lastMessageByMatch.get(m.id);

      results.push({
        id: m.id,
        createdAt: m.createdAt.toISOString(),
        updatedAt: (last?.createdAt || m.updatedAt).toISOString(),
        partner,
        sharedInterests: partner.sharedInterests || [],
        lastMessage: last
          ? {
              id: last.id,
              senderId: last.senderId,
              content: last.content,
              createdAt: last.createdAt.toISOString(),
              readAt: last.readAt ? last.readAt.toISOString() : null,
            }
          : null,
        unreadCount: unreadCountByMatch.get(m.id) || 0,
      });
    }

    results.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return results;
  } catch (error) {
    console.error('Database query failed (getActiveMatches):', error);
    throw new AppQueryError('Could not load your matches right now.', 500);
  }
}

async function assertActiveMatchParticipant(matchId: number, uid: string) {
  const rows = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (rows.length === 0) {
    throw new AppQueryError('Conversation not found.', 404);
  }
  const match = rows[0];
  if (match.user1Id !== uid && match.user2Id !== uid) {
    throw new AppQueryError(
      'You do not have permission to access this conversation.',
      403
    );
  }
  if (match.status !== 'active') {
    throw new AppQueryError('This match is no longer active.', 410, 'MATCH_INACTIVE');
  }
  const partnerId = match.user1Id === uid ? match.user2Id : match.user1Id;
  if (await hasBlockBetween(uid, partnerId)) {
    throw new AppQueryError(
      'Messaging is unavailable for this user.',
      403,
      'USER_BLOCKED'
    );
  }
  return { match, partnerId };
}

export async function getMatchMessages(
  matchId: number,
  uid: string
): Promise<MessageDTO[]> {
  await assertActiveMatchParticipant(matchId, uid);
  try {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.matchId, matchId))
      .orderBy(asc(messages.createdAt))
      .limit(200);

    return rows.map((r) => ({
      id: r.id,
      matchId: r.matchId,
      senderId: r.senderId,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt ? r.readAt.toISOString() : null,
    }));
  } catch (error) {
    console.error('Database query failed (getMatchMessages):', error);
    throw new AppQueryError('Could not load messages right now.', 500);
  }
}

export async function createMatchMessage(
  matchId: number,
  senderId: string,
  contentRaw: string
): Promise<{ message: MessageDTO; partnerId: string }> {
  const content = contentRaw.trim();
  if (!content) {
    throw new AppQueryError('Message cannot be empty.', 400);
  }
  if (content.length > 1000) {
    throw new AppQueryError(
      'Message is too long (maximum 1000 characters).',
      400
    );
  }

  const { partnerId } = await assertActiveMatchParticipant(matchId, senderId);

  try {
    const inserted = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(messages)
        .values({
          matchId,
          senderId,
          content,
        })
        .returning();

      await tx
        .update(matches)
        .set({ updatedAt: new Date() })
        .where(eq(matches.id, matchId));

      return rows[0];
    });

    return {
      partnerId,
      message: {
        id: inserted.id,
        matchId: inserted.matchId,
        senderId: inserted.senderId,
        content: inserted.content,
        createdAt: inserted.createdAt.toISOString(),
        readAt: inserted.readAt ? inserted.readAt.toISOString() : null,
      },
    };
  } catch (error) {
    console.error('Database query failed (createMatchMessage):', error);
    throw new AppQueryError(
      'Message could not be sent. Please try again.',
      500
    );
  }
}

export async function markMatchMessagesRead(
  matchId: number,
  readerId: string
): Promise<{ partnerId: string; readAt: string } | null> {
  const { partnerId } = await assertActiveMatchParticipant(matchId, readerId);
  try {
    const now = new Date();
    const updated = await db
      .update(messages)
      .set({ readAt: now })
      .where(
        and(
          eq(messages.matchId, matchId),
          ne(messages.senderId, readerId),
          isNull(messages.readAt)
        )
      )
      .returning({ id: messages.id });

    if (updated.length === 0) return null;
    return { partnerId, readAt: now.toISOString() };
  } catch (error) {
    console.error('Database query failed (markMatchMessagesRead):', error);
    return null;
  }
}

export async function unmatchById(
  matchId: number,
  uid: string
): Promise<{ user1Id: string; user2Id: string }> {
  const { match } = await assertActiveMatchParticipant(matchId, uid);
  try {
    await db
      .update(matches)
      .set({ status: 'unmatched', updatedAt: new Date() })
      .where(eq(matches.id, matchId));

    return { user1Id: match.user1Id, user2Id: match.user2Id };
  } catch (error) {
    console.error('Database query failed (unmatchById):', error);
    throw new AppQueryError(
      'Could not unmatch right now. Please try again.',
      500
    );
  }
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string
): Promise<{ affectedMatchIds: number[] }> {
  if (blockerId === blockedId) {
    throw new AppQueryError('You cannot block yourself.', 400);
  }

  try {
    const targetRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, blockedId))
      .limit(1);

    if (targetRows.length === 0) {
      throw new AppQueryError('User not found.', 404);
    }

    const [user1Id, user2Id] = canonicalPair(blockerId, blockedId);
    const affectedMatchIds: number[] = [];

    await db.transaction(async (tx) => {
      await tx
        .insert(blocks)
        .values({
          blockerId,
          blockedId,
          reason: reason ? reason.trim().slice(0, 240) : null,
        })
        .onConflictDoNothing({ target: [blocks.blockerId, blocks.blockedId] });

      const updatedMatches = await tx
        .update(matches)
        .set({ status: 'blocked', updatedAt: new Date() })
        .where(and(eq(matches.user1Id, user1Id), eq(matches.user2Id, user2Id)))
        .returning({ id: matches.id });

      for (const m of updatedMatches) {
        affectedMatchIds.push(m.id);
      }
    });

    return { affectedMatchIds };
  } catch (error: any) {
    if (error instanceof AppQueryError) throw error;
    console.error('Database query failed (blockUser):', error);
    throw new AppQueryError(
      'Could not block this user right now. Please try again.',
      500
    );
  }
}

export async function deleteUserAccount(uid: string): Promise<{
  affectedMatches: Array<{ matchId: number; partnerId: string }>;
}> {
  try {
    const [photoRows, activeMatches] = await Promise.all([
      db
        .select({ storagePath: profilePhotos.storagePath })
        .from(profilePhotos)
        .where(eq(profilePhotos.userId, uid)),
      db
        .select({
          id: matches.id,
          user1Id: matches.user1Id,
          user2Id: matches.user2Id,
        })
        .from(matches)
        .where(
          and(
            eq(matches.status, 'active'),
            or(eq(matches.user1Id, uid), eq(matches.user2Id, uid))
          )
        ),
    ]);

    const affectedMatches = activeMatches.map((m) => ({
      matchId: m.id,
      partnerId: m.user1Id === uid ? m.user2Id : m.user1Id,
    }));

    // Cascading foreign keys remove profile_photos, likes, passes, matches, messages, and blocks
    await db.delete(profiles).where(eq(profiles.id, uid));

    for (const photo of photoRows) {
      await deleteStoredPhotoFile(photo.storagePath);
    }

    return { affectedMatches };
  } catch (error) {
    console.error('Database query failed (deleteUserAccount):', error);
    throw new AppQueryError(
      'Could not delete your account right now. Please try again.',
      500
    );
  }
}
