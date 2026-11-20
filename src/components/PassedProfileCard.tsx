import React from 'react';
import { BadgeCheck, Heart, Undo2 } from 'lucide-react';
import { PassedProfile } from '../types/nearu';
import { AvatarPhoto } from './AvatarPhoto';

interface PassedProfileCardProps {
  profile: PassedProfile;
  busy?: boolean;
  onUndoPass: () => void;
  onLike: () => void;
}

// Compact card used by the "Passed" view on the Discover screen.
// Visual language (colors, radii, buttons) intentionally mirrors ProfileCardView.
export function PassedProfileCard({
  profile,
  busy = false,
  onUndoPass,
  onLike,
}: PassedProfileCardProps) {
  const sharedSet = new Set((profile.sharedInterests || []).map((i) => i.toLowerCase()));

  const metaParts = [
    profile.branch,
    profile.batchYear
      ? /^\d{4}$/.test(profile.batchYear)
        ? `Batch of ${profile.batchYear}`
        : profile.batchYear
      : null,
  ].filter(Boolean);

  const visibleInterests = (profile.interests || []).slice(0, 4);
  const hiddenCount = Math.max((profile.interests || []).length - visibleInterests.length, 0);

  return (
    <article className="min-w-0 flex flex-col rounded-3xl overflow-hidden bg-[#121317] border border-[#2A2B32]">
      <div className="relative w-full aspect-[4/5] select-none">
        <AvatarPhoto
          src={profile.photos?.[0]?.url || null}
          alt={`${profile.fullName || 'Student'} photo`}
          name={profile.fullName}
          className="w-full h-full"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0D0E12] via-[#0D0E12]/65 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-display text-xl font-bold text-[#F3F4F6] truncate">
              {profile.fullName || 'Student'}
              {profile.age !== null && (
                <span className="font-normal text-[#F3F4F6]/85 tabular-nums">, {profile.age}</span>
              )}
            </h3>
            {profile.isVerified && (
              <BadgeCheck
                className="w-4 h-4 text-[#8B5CF6] shrink-0"
                aria-label="Verified campus student"
              />
            )}
          </div>
          {metaParts.length > 0 && (
            <p className="text-xs text-[#D1D5DB] mt-0.5 truncate">{metaParts.join(' · ')}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0 p-4 sm:p-5 gap-3">
        <p className="text-sm text-[#D1D5DB] leading-relaxed break-words line-clamp-3">
          {profile.bio || 'No bio added yet.'}
        </p>

        {visibleInterests.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {visibleInterests.map((interest) => (
              <span
                key={interest}
                className={
                  sharedSet.has(interest.toLowerCase())
                    ? 'text-[#F472B6] font-medium'
                    : 'text-[#9CA3AF]'
                }
              >
                {interest}
              </span>
            ))}
            {hiddenCount > 0 && <span className="text-[#9CA3AF]">+{hiddenCount} more</span>}
          </div>
        )}

        <div className="mt-auto pt-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onUndoPass}
            disabled={busy}
            className="min-h-[48px] px-3 py-2.5 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] active:scale-[0.98] disabled:opacity-50 text-[#F3F4F6] font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            title="Remove your pass so this profile can appear in Discover again"
          >
            <Undo2 className="w-4 h-4 text-[#9CA3AF]" />
            <span>Undo Pass</span>
          </button>

          <button
            type="button"
            onClick={onLike}
            disabled={busy}
            className="min-h-[48px] px-3 py-2.5 rounded-2xl bg-[#E05A6D] hover:bg-[#d14c60] active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_8px_28px_rgba(224,90,109,0.28)] transition-all cursor-pointer whitespace-nowrap"
          >
            <Heart className="w-4 h-4 fill-current" />
            <span>Like</span>
          </button>
        </div>
      </div>
    </article>
  );
}
