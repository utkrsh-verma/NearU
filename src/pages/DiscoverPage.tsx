import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Compass, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { MatchSummary, PublicProfile } from '../types/nearu';
import { ProfileCardView } from '../components/ProfileCardView';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface DiscoverPageProps {
  onMutualMatch: (match: MatchSummary) => void;
  onMatchesChanged: () => void;
  excludedProfileIds?: string[];
}

type GenderFilter = 'all' | 'man' | 'woman';

const genderFilters: Array<{ value: GenderFilter; label: string; symbol: string }> = [
  { value: 'all', label: 'All', symbol: '◎' },
  { value: 'man', label: 'Male', symbol: '♂' },
  { value: 'woman', label: 'Female', symbol: '♀' },
];

export function DiscoverPage({
  onMutualMatch,
  onMatchesChanged,
  excludedProfileIds = [],
}: DiscoverPageProps) {
  const [queue, setQueue] = useState<PublicProfile[]>([]);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<PublicProfile | null>(null);
  const [blocking, setBlocking] = useState(false);

  const loadQueue = useCallback(async (filter: GenderFilter = 'all') => {
    setLoading(true);
    setError(null);
    try {
      const { profiles } = await api.getDiscoverQueue(filter);
      setQueue(profiles);
    } catch (err: any) {
      setError(err?.message || 'Unable to reach NearU right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Prune any profile that matched or became blocked in real time
  useEffect(() => {
    if (excludedProfileIds.length === 0) return;
    const set = new Set(excludedProfileIds);
    setQueue((prev) => prev.filter((p) => !set.has(p.id)));
  }, [excludedProfileIds]);

  const currentProfile = queue[0] || null;

  const selectGenderFilter = (filter: GenderFilter) => {
    if (filter === genderFilter) return;
    setGenderFilter(filter);
    setQueue([]);
    loadQueue(filter);
  };

  const advanceDeck = useCallback((id: string) => {
    setQueue((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handlePass = useCallback(async () => {
    if (!currentProfile || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    const targetId = currentProfile.id;
    try {
      await api.passProfile(targetId);
      advanceDeck(targetId);
    } catch (err: any) {
      if (err?.status === 410 || err?.code === 'PROFILE_UNAVAILABLE') {
        advanceDeck(targetId);
        setActionError('That profile is no longer available.');
      } else {
        setActionError(err?.message || 'Could not record pass. Please try again.');
      }
    } finally {
      setActionBusy(false);
    }
  }, [currentProfile, actionBusy, advanceDeck]);

  const handleLike = useCallback(async () => {
    if (!currentProfile || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    const targetId = currentProfile.id;
    try {
      const result = await api.likeProfile(targetId);
      advanceDeck(targetId);
      if (result.matched && result.match) {
        onMatchesChanged();
        onMutualMatch(result.match);
      }
    } catch (err: any) {
      if (err?.status === 410 || err?.code === 'PROFILE_UNAVAILABLE') {
        advanceDeck(targetId);
        setActionError('That profile is no longer available.');
      } else {
        setActionError(err?.message || 'Could not send like. Please try again.');
      }
    } finally {
      setActionBusy(false);
    }
  }, [currentProfile, actionBusy, advanceDeck, onMutualMatch, onMatchesChanged]);

  const handleConfirmBlock = async (reason?: string) => {
    if (!blockTarget) return;
    setBlocking(true);
    setActionError(null);
    try {
      await api.blockUser(blockTarget.id, reason);
      advanceDeck(blockTarget.id);
      onMatchesChanged();
      setBlockTarget(null);
    } catch (err: any) {
      setActionError(err?.message || 'Could not block user.');
    } finally {
      setBlocking(false);
    }
  };

  // Desktop keyboard shortcuts (ArrowLeft = Pass, ArrowRight = Like)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (blockTarget || actionBusy || !currentProfile) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePass();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleLike();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [blockTarget, actionBusy, currentProfile, handlePass, handleLike]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
      <div className="flex items-center justify-between gap-4 mb-5 sm:mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3F4F6] tracking-tight">
            Discover
          </h1>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-0.5">
            Verified students around your campus
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadQueue(genderFilter)}
          disabled={loading}
          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#121317] border border-[#2A2B32] hover:bg-[#1A1B20] text-xs font-medium text-[#D1D5DB] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div
        className="mb-5 inline-flex max-w-full rounded-xl border border-[#2A2B32] bg-[#121317] p-1"
        role="group"
        aria-label="Filter profiles by gender"
      >
        {genderFilters.map((filter) => {
          const active = genderFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => selectGenderFilter(filter.value)}
              aria-pressed={active}
              className={`min-h-[36px] rounded-lg px-2.5 sm:px-3 text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                active
                  ? 'bg-[#E05A6D] text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:bg-[#1A1B20] hover:text-[#F3F4F6]'
              }`}
            >
              <span className="text-sm leading-none" aria-hidden="true">{filter.symbol}</span>
              {filter.label}
            </button>
          );
        })}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-5 rounded-2xl bg-[#1A1B20] border border-[#E05A6D]/50 p-4 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 text-[#E05A6D] shrink-0" />
            <p className="text-sm text-[#F3F4F6] truncate">{actionError}</p>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-medium text-[#F472B6] hover:underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-6 rounded-3xl bg-[#121317] border border-[#2A2B32] aspect-[3/4] max-h-[600px] animate-pulse" />
          <div className="lg:col-span-6 rounded-3xl bg-[#121317] border border-[#2A2B32] p-8 space-y-6 animate-pulse">
            <div className="h-5 w-40 bg-[#1A1B20] rounded-lg" />
            <div className="space-y-3">
              <div className="h-4 w-full bg-[#1A1B20] rounded-lg" />
              <div className="h-4 w-5/6 bg-[#1A1B20] rounded-lg" />
              <div className="h-4 w-2/3 bg-[#1A1B20] rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-12">
              <div className="h-14 bg-[#1A1B20] rounded-2xl" />
              <div className="h-14 bg-[#1A1B20] rounded-2xl" />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-[#121317] border border-[#2A2B32] rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#E05A6D] mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#F3F4F6]">
            Could not load campus profiles
          </h2>
          <p className="text-sm text-[#9CA3AF] mt-2 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => loadQueue(genderFilter)}
            className="mt-6 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#E05A6D] hover:bg-[#cf4c5f] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty Discover State */}
      {!loading && !error && !currentProfile && (
        <div className="bg-[#121317] border border-[#2A2B32] rounded-3xl p-8 sm:p-14 text-center max-w-xl mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#F472B6] mx-auto mb-5">
            <Compass className="w-7 h-7" />
          </div>
          <h2 className="font-display text-2xl font-bold text-[#F3F4F6]">
            No profiles found
          </h2>
          <p className="text-sm sm:text-base text-[#9CA3AF] mt-2.5 leading-relaxed max-w-md mx-auto">
            No verified {genderFilter === 'all' ? '' : genderFilter === 'man' ? 'male ' : 'female '}
            profiles are available right now. Try another filter or check back soon.
          </p>
          <button
            type="button"
            onClick={() => loadQueue(genderFilter)}
            className="mt-7 min-h-[46px] px-6 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] hover:bg-[#2A2B32] text-[#F3F4F6] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Check for new profiles</span>
          </button>
        </div>
      )}

      {/* Active Profile Card */}
      {!loading && !error && currentProfile && (
        <ProfileCardView
          profile={currentProfile}
          busy={actionBusy}
          onPass={handlePass}
          onLike={handleLike}
          onBlock={() => setBlockTarget(currentProfile)}
        />
      )}

      <ConfirmDialog
        open={Boolean(blockTarget)}
        mode="block"
        targetName={blockTarget?.fullName || 'this student'}
        loading={blocking}
        onCancel={() => setBlockTarget(null)}
        onConfirm={handleConfirmBlock}
      />
    </div>
  );
}
