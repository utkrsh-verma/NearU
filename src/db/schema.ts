import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Profiles table keyed directly by Supabase Auth User ID (UUID)
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(), // Supabase Auth User ID (UUID)
    email: text('email').notNull().unique(),
    collegeEmail: text('college_email'),
    rollNumber: text('roll_number'),
    verificationMethod: text('verification_method'), // 'domain_email' | 'campus_invite'
    isVerified: boolean('is_verified').notNull().default(false),
    isProfileComplete: boolean('is_profile_complete').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    fullName: text('full_name'),
    dateOfBirth: date('date_of_birth'), // YYYY-MM-DD
    gender: text('gender'),
    branch: text('branch'),
    batchYear: text('batch_year'),
    campusSpot: text('campus_spot'),
    bio: text('bio'),
    lookingFor: text('looking_for'),
    interests: jsonb('interests').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_profiles_eligible').on(
      table.isVerified,
      table.isProfileComplete,
      table.isActive
    ),
  ]
);

// Profile photos table
export const profilePhotos = pgTable(
  'profile_photos',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    // Temporary safety copy used only while legacy data URLs are migrated to Storage.
    legacyDataUrl: text('legacy_data_url'),
    mimeType: text('mime_type').notNull().default('image/webp'),
    displayOrder: integer('display_order').notNull(), // 1 or 2
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_profile_photos_user_order').on(
      table.userId,
      table.displayOrder
    ),
    index('idx_profile_photos_user').on(table.userId),
  ]
);

// Likes table
export const likes = pgTable(
  'likes',
  {
    id: serial('id').primaryKey(),
    likerId: uuid('liker_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    likedId: uuid('liked_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_likes_pair').on(table.likerId, table.likedId),
    index('idx_likes_liked_id').on(table.likedId),
  ]
);

// Passes table
export const passes = pgTable(
  'passes',
  {
    id: serial('id').primaryKey(),
    passerId: uuid('passer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    passedId: uuid('passed_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_passes_pair').on(table.passerId, table.passedId),
    index('idx_passes_passer_id').on(table.passerId),
  ]
);

// Mutual matches table
export const matches = pgTable(
  'matches',
  {
    id: serial('id').primaryKey(),
    user1Id: uuid('user1_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    user2Id: uuid('user2_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'), // 'active' | 'unmatched' | 'blocked'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_matches_pair').on(table.user1Id, table.user2Id),
    index('idx_matches_user1').on(table.user1Id),
    index('idx_matches_user2').on(table.user2Id),
  ]
);

// Messages table
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_messages_match_created').on(table.matchId, table.createdAt)]
);

// Blocks table
export const blocks = pgTable(
  'blocks',
  {
    id: serial('id').primaryKey(),
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_blocks_pair').on(table.blockerId, table.blockedId),
    index('idx_blocks_blocked_id').on(table.blockedId),
  ]
);

// Configurable campus access codes table
export const campusAccessCodes = pgTable('campus_access_codes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  label: text('label').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Drizzle Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  photos: many(profilePhotos),
}));

export const profilePhotosRelations = relations(profilePhotos, ({ one }) => ({
  profile: one(profiles, {
    fields: [profilePhotos.userId],
    references: [profiles.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  user1: one(profiles, {
    fields: [matches.user1Id],
    references: [profiles.id],
  }),
  user2: one(profiles, {
    fields: [matches.user2Id],
    references: [profiles.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  match: one(matches, {
    fields: [messages.matchId],
    references: [matches.id],
  }),
  sender: one(profiles, {
    fields: [messages.senderId],
    references: [profiles.id],
  }),
}));
