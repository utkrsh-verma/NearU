import React, { useState, useEffect } from 'react';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  ShieldAlert,
  X,
} from 'lucide-react';
import { PublicProfile } from '../types/nearu';
import { AvatarPhoto } from './AvatarPhoto';

interface ProfileCardViewProps {
  profile: PublicProfile;
  isPreview?: boolean;
  busy?: boolean;
  onPass?: () => void;
  onLike?: () => void;
  likeLabel?: string;
  onBlock?: () => void;
}

export function ProfileCardView({
  profile,
  isPreview = false,
  busy = false,
  onPass,
  onLike,
  likeLabel = 'Like',
  onBlock,
}: ProfileCardViewProps) {
  const [photoIdx, setPhotoIdx] = useState(0);

  // Reset photo index whenever the displayed profile changes
  useEffect(() => {
    setPhotoIdx(0);
  }, [profile.id]);

  const photos = profile.photos || [];
  const totalPhotos = Math.max(photos.length, 1);
  const activePhoto = photos[photoIdx]?.url || null;

  const nextPhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIdx((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIdx((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const sharedSet = new Set(
    (profile.sharedInterests || []).map((item) => item.toLowerCase())
  );

  const metaParts = [
    profile.branch,
    profile.batchYear
      ? /^\d{4}$/.test(profile.batchYear)
        ? `Batch of ${profile.batchYear}`
        : profile.batchYear
      : null,
    profile.gender,
  ].filter(Boolean);

  return (
    <div className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-stretch">
      {/* Left / Primary Portrait Card */}
      <div className="lg:col-span-6 min-w-0 relative rounded-3xl overflow-hidden bg-[#121317] border border-[#2A2B32] aspect-[3/4] max-h-[640px] w-full mx-auto select-none">
        <AvatarPhoto
          src={activePhoto}
          alt={`${profile.fullName || 'Student'} photo ${photoIdx + 1}`}
          name={profile.fullName}
          lazy={false}
          className="w-full h-full"
        />

        {/* Instagram-style photo progress dashes */}
        {totalPhotos > 1 && (
          <div className="absolute top-3.5 left-4 right-4 z-20 flex items-center gap-1.5">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setPhotoIdx(idx)}
                aria-label={`View photo ${idx + 1}`}
                className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/25 transition-colors"
              >
                <span
                  className={`block h-full rounded-full transition-all duration-200 ${
                    idx === photoIdx ? 'w-full bg-white' : 'w-0'
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        {/* Left / Right tap zones to toggle between photos 1 and 2 */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevPhoto}
              aria-label="Previous photo"
              className="absolute inset-y-14 left-0 w-1/3 z-10 flex items-center justify-start pl-3 group focus:outline-none"
            >
              <span className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm text-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronLeft className="w-5 h-5" />
              </span>
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              aria-label="Next photo"
              className="absolute inset-y-14 right-0 w-1/3 z-10 flex items-center justify-end pr-3 group focus:outline-none"
            >
              <span className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm text-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5" />
              </span>
            </button>
          </>
        )}

        {/* Measured bottom scrim for legibility on mobile (desktop shows dossier on right, mobile overlays summary) */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#0D0E12] via-[#0D0E12]/65 to-transparent pointer-events-none" />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 z-20">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#F3F4F6] truncate">
                  {profile.fullName || 'Your Name'}
                  {profile.age !== null && (
                    <span className="font-normal text-[#F3F4F6]/85 tabular-nums">
                      , {profile.age}
                    </span>
                  )}
                </h2>
                {profile.isVerified && (
                  <BadgeCheck
                    className="w-5 h-5 text-[#8B5CF6] shrink-0"
                    aria-label="Verified campus student"
                  />
                )}
              </div>

              {metaParts.length > 0 && (
                <p className="text-sm text-[#D1D5DB] mt-1 truncate">
                  {metaParts.join(' · ')}
                </p>
              )}
            </div>

            {photos.length > 1 && (
              <span className="text-xs font-medium text-[#D1D5DB] tabular-nums shrink-0 bg-black/45 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                {photoIdx + 1} / {photos.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Editorial Dossier & Action Column */}
      <div className="lg:col-span-6 min-w-0 overflow-hidden flex flex-col justify-between bg-[#121317] border border-[#2A2B32] rounded-3xl p-5 sm:p-8">
        <div className="space-y-6 min-w-0">
          {/* Campus Trust Header (unboxed metadata) */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pb-4 border-b border-[#2A2B32] min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#9CA3AF] min-w-0">
              <BadgeCheck className="w-4 h-4 text-[#8B5CF6] shrink-0" />
              <span className="text-[#F3F4F6] font-medium">Campus Verified</span>
              {profile.lookingFor && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#F472B6] break-words">{profile.lookingFor}</span>
                </>
              )}
            </div>
            {!isPreview && onBlock && (
              <button
                type="button"
                onClick={onBlock}
                disabled={busy}
                className="min-h-[36px] px-2.5 rounded-lg text-xs text-[#9CA3AF] hover:text-[#E05A6D] hover:bg-[#1A1B20] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title="Block this profile"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Block</span>
              </button>
            )}
          </div>

          {/* About / Bio */}
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#9CA3AF] mb-2">About</p>
            <p className="text-base text-[#F3F4F6] leading-relaxed break-words">
              {profile.bio || 'No bio added yet.'}
            </p>
          </div>

          {/* Looking For */}
          {profile.lookingFor && (
            <div className="pt-4 border-t border-[#2A2B32]/70 min-w-0">
              <p className="text-xs font-medium text-[#9CA3AF] mb-1.5">Looking for</p>
              <div className="flex items-center gap-2 text-sm text-[#F3F4F6] font-medium min-w-0">
                <Compass className="w-4 h-4 text-[#E05A6D] shrink-0" />
                <span className="break-words">{profile.lookingFor}</span>
              </div>
            </div>
          )}

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <div className="pt-4 border-t border-[#2A2B32]/70">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-medium text-[#9CA3AF]">Campus interests</p>
                {profile.sharedInterests && profile.sharedInterests.length > 0 && (
                  <p className="text-xs text-[#F472B6] font-medium tabular-nums">
                    {profile.sharedInterests.length} in common
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {profile.interests.map((interest) => {
                  const isShared = sharedSet.has(interest.toLowerCase());
                  return (
                    <span
                      key={interest}
                      className={
                        isShared
                          ? 'text-[#F472B6] font-medium'
                          : 'text-[#D1D5DB]'
                      }
                    >
                      {interest}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Ergonomic Pass & Like Action Bar */}
        {!isPreview && onLike && (
          <div className="pt-6 mt-6 border-t border-[#2A2B32]">
            <div className={onPass ? 'grid grid-cols-2 gap-3 sm:gap-4' : ''}>
              {onPass && <button
                type="button"
                onClick={onPass}
                disabled={busy}
                className="min-h-[54px] px-5 py-3 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] active:scale-[0.98] disabled:opacity-50 text-[#F3F4F6] font-semibold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <X className="w-5 h-5 text-[#9CA3AF]" />
                <span>Pass</span>
              </button>}

              <button
                type="button"
                onClick={onLike}
                disabled={busy}
                className="min-h-[54px] px-5 py-3 rounded-2xl bg-[#E05A6D] hover:bg-[#d14c60] active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-[0_8px_28px_rgba(224,90,109,0.28)] transition-all cursor-pointer whitespace-nowrap"
              >
                <Heart className="w-5 h-5 fill-current" />
                <span>{likeLabel}</span>
              </button>
            </div>
            {onPass && <p className="hidden lg:block text-center text-xs text-[#9CA3AF] mt-3">
              Keyboard shortcuts: Left arrow to Pass · Right arrow to Like
            </p>}
          </div>
        )}
      </div>
    </div>
  );
}
