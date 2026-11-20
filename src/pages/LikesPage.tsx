import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Heart, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { MatchSummary, PublicProfile } from '../types/nearu';
import { ProfileCardView } from '../components/ProfileCardView';

interface LikesPageProps {
  refreshToken: number;
  onLikeCountChanged: (count: number) => void;
  onMutualMatch: (match: MatchSummary) => void;
  onMatchesChanged: () => void;
}

export function LikesPage({ refreshToken, onLikeCountChanged, onMutualMatch, onMatchesChanged }: LikesPageProps) {
  const [likes, setLikes] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadLikes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getReceivedLikes();
      setLikes(result.profiles);
      onLikeCountChanged(result.count);
    } catch (err: any) {
      setError(err?.message || 'Unable to load likes right now.');
    } finally {
      setLoading(false);
    }
  }, [onLikeCountChanged]);

  useEffect(() => { loadLikes(); }, [loadLikes, refreshToken]);

  const current = likes[0] || null;
  const likeBack = async () => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.likeProfile(current.id);
      setLikes((previous) => {
        const next = previous.filter((profile) => profile.id !== current.id);
        onLikeCountChanged(next.length);
        return next;
      });
      if (result.matched && result.match) {
        onMatchesChanged();
        onMutualMatch(result.match);
      }
    } catch (err: any) {
      if (err?.status === 410 || err?.code === 'PROFILE_UNAVAILABLE') {
        setLikes((previous) => previous.filter((profile) => profile.id !== current.id));
      } else {
        setError(err?.message || 'Could not like this profile back.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
      <div className="flex items-center justify-between gap-4 mb-5 sm:mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3F4F6] tracking-tight">Likes</h1>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-0.5">Students who want to get to know you</p>
        </div>
        <button type="button" onClick={loadLikes} disabled={loading} className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#121317] border border-[#2A2B32] hover:bg-[#1A1B20] text-xs font-medium text-[#D1D5DB] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 animate-pulse"><div className="lg:col-span-6 aspect-[3/4] rounded-3xl bg-[#121317] border border-[#2A2B32]" /><div className="lg:col-span-6 rounded-3xl bg-[#121317] border border-[#2A2B32]" /></div>}
      {!loading && error && <div className="bg-[#121317] border border-[#2A2B32] rounded-3xl p-8 text-center max-w-lg mx-auto my-8"><AlertCircle className="w-7 h-7 text-[#E05A6D] mx-auto mb-3" /><p className="text-sm text-[#9CA3AF]">{error}</p><button type="button" onClick={loadLikes} className="mt-5 min-h-[44px] px-5 rounded-xl bg-[#E05A6D] text-white text-sm font-semibold cursor-pointer">Try again</button></div>}
      {!loading && !error && !current && <div className="bg-[#121317] border border-[#2A2B32] rounded-3xl p-8 sm:p-14 text-center max-w-xl mx-auto my-6"><div className="w-14 h-14 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#F472B6] mx-auto mb-5"><Heart className="w-7 h-7" /></div><h2 className="font-display text-2xl font-bold text-[#F3F4F6]">Your story starts with a like.</h2><p className="text-sm sm:text-base text-[#9CA3AF] mt-2.5 leading-relaxed">Someone new might be interested in you. Check back soon.</p><Sparkles className="w-4 h-4 text-[#F472B6] mx-auto mt-5" /></div>}
      {!loading && !error && current && <ProfileCardView profile={current} busy={busy} onLike={likeBack} likeLabel="Like back" />}
    </div>
  );
}
