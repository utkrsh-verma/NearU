import React, { useState } from 'react';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { MatchSummary, MyProfile } from '../types/nearu';
import { buildIcebreakers } from '../lib/constants';
import { AvatarPhoto } from './AvatarPhoto';

interface MatchCelebrationModalProps {
  match: MatchSummary | null;
  me: MyProfile;
  onKeepDiscovering: () => void;
  onOpenChat: (match: MatchSummary) => void;
  onSendIcebreaker: (match: MatchSummary, text: string) => Promise<void>;
}

export function MatchCelebrationModal({
  match,
  me,
  onKeepDiscovering,
  onOpenChat,
  onSendIcebreaker,
}: MatchCelebrationModalProps) {
  const [sendingText, setSendingText] = useState<string | null>(null);

  if (!match) return null;

  const myPhoto = me.photos[0]?.url || null;
  const partnerPhoto = match.partner.photos[0]?.url || null;
  const icebreakers = buildIcebreakers(match.sharedInterests);

  const handleIcebreaker = async (text: string) => {
    setSendingText(text);
    try {
      await onSendIcebreaker(match, text);
    } finally {
      setSendingText(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0E12]/92 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-celebration-title"
    >
      <div className="w-full max-w-lg bg-[#121317] border border-[#2A2B32] rounded-3xl p-6 sm:p-8 text-center shadow-[0_24px_80px_rgba(244,114,182,0.16)]">
        {/* Dual overlapping profile portraits */}
        <div className="flex items-center justify-center mb-6 pt-2">
          <div className="relative flex items-center justify-center">
            <div className="w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 border-[#2A2B32] -rotate-6 shadow-xl bg-[#1A1B20]">
              <AvatarPhoto
                src={myPhoto}
                alt={me.fullName || 'You'}
                name={me.fullName}
                lazy={false}
              />
            </div>
            <div className="w-11 h-11 rounded-full bg-[#E05A6D] text-white flex items-center justify-center z-10 -mx-4 shadow-[0_0_24px_rgba(224,90,109,0.55)] border-4 border-[#121317]">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div className="w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 border-[#E05A6D]/70 rotate-6 shadow-xl bg-[#1A1B20]">
              <AvatarPhoto
                src={partnerPhoto}
                alt={match.partner.fullName}
                name={match.partner.fullName}
                lazy={false}
              />
            </div>
          </div>
        </div>

        <h2
          id="match-celebration-title"
          className="font-display text-3xl sm:text-4xl font-bold text-[#F3F4F6] tracking-tight"
        >
          It&apos;s a Match!
        </h2>
        <p className="text-sm sm:text-base text-[#9CA3AF] mt-2 max-w-sm mx-auto">
          You and <span className="text-[#F3F4F6] font-medium">{match.partner.fullName}</span>{' '}
          both liked each other on campus.
        </p>

        {match.sharedInterests.length > 0 && (
          <p className="text-xs sm:text-sm text-[#F472B6] font-medium mt-3">
            In common: {match.sharedInterests.slice(0, 3).join(' · ')}
          </p>
        )}

        {/* Frictionless one-tap campus icebreakers */}
        <div className="mt-6 text-left">
          <p className="text-xs font-medium text-[#9CA3AF] mb-2.5 text-center">
            Break the ice with one tap
          </p>
          <div className="space-y-2">
            {icebreakers.map((line) => (
              <button
                key={line}
                type="button"
                disabled={Boolean(sendingText)}
                onClick={() => handleIcebreaker(line)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] hover:border-[#E05A6D]/60 text-left text-sm text-[#F3F4F6] flex items-center justify-between gap-3 transition-colors cursor-pointer disabled:opacity-60"
              >
                <span className="leading-snug">{line}</span>
                <Send className="w-4 h-4 text-[#E05A6D] shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenChat(match)}
            disabled={Boolean(sendingText)}
            className="w-full sm:flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-[#E05A6D] hover:bg-[#d14c60] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Send Message</span>
          </button>
          <button
            type="button"
            onClick={onKeepDiscovering}
            disabled={Boolean(sendingText)}
            className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] text-[#F3F4F6] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            Keep Discovering
          </button>
        </div>
      </div>
    </div>
  );
}
