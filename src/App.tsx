import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppTab, ChatMessage, MatchSummary } from './types/nearu';
import { api } from './services/api';
import { useRealtime } from './hooks/useRealtime';
import { useLiveRefresh } from './hooks/useLiveRefresh';
import { AppShell } from './layouts/AppShell';
import { LandingPage } from './pages/LandingPage';
import { CampusVerifyPage } from './pages/CampusVerifyPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { LikesPage } from './pages/LikesPage';
import { MatchesChatPage } from './pages/MatchesChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { MatchCelebrationModal } from './components/MatchCelebrationModal';

const RECENTLY_ACTIVE_MS = 60_000;

function AuthenticatedWorkspace() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>('discover');
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [messagesByMatch, setMessagesByMatch] = useState<Record<number, ChatMessage[]>>({});
  const [celebrationMatch, setCelebrationMatch] = useState<MatchSummary | null>(null);
  const [likesTotal, setLikesTotal] = useState(0);
  const [likesRefreshToken, setLikesRefreshToken] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});

  // Latest values for the live-refresh callbacks (so timers never read stale state)
  const activeTabRef = useRef<AppTab>(activeTab);
  const viewingMatchIdRef = useRef<number | null>(null);
  const matchesRef = useRef<MatchSummary[]>([]);
  const matchesLoadedRef = useRef(false);
  const profileIdRef = useRef<string | undefined>(profile?.id);
  // Out-of-order protection for background refreshes
  const likesRequestRef = useRef(0);
  const lastRealtimeEventRef = useRef(0);
  activeTabRef.current = activeTab;
  profileIdRef.current = profile?.id;
  viewingMatchIdRef.current = activeTab === 'matches' ? selectedMatchId : null;
  matchesRef.current = matches;

  const refreshLikes = useCallback(async () => {
    // Several triggers can fire at once; only the most recently started request may update the
    // badge, so a slow older reply can't overwrite a newer one.
    const requestId = ++likesRequestRef.current;
    try {
      const { count } = await api.getReceivedLikes();
      if (requestId === likesRequestRef.current) setLikesTotal(count);
    } catch {
      // The Likes page will show a retryable error if the user opens it.
    }
  }, []);

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    setMatchesError(null);
    try {
      const { matches: fetched } = await api.getMatches();
      setMatches(fetched);
      matchesLoadedRef.current = true;
    } catch (err: any) {
      setMatchesError(err?.message || 'Could not load matches.');
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    refreshLikes();
  }, [refreshLikes]);

  const loadMessages = useCallback(async (matchId: number) => {
    const { messages } = await api.getMessages(matchId);
    setMessagesByMatch((prev) => ({ ...prev, [matchId]: messages }));
  }, []);

  // ---- Background refresh for hosts without WebSockets (Vercel serverless) ----

  const refreshMatchesSilently = useCallback(async () => {
    const startedAt = Date.now();
    try {
      const { matches: fetched } = await api.getMatches();
      // A live (WebSocket) event arrived while this request was in flight: local state is newer
      // than this snapshot, so don't overwrite it. The next refresh reconciles.
      if (lastRealtimeEventRef.current > startedAt) return;
      const viewingId = viewingMatchIdRef.current;
      const known = new Set(matchesRef.current.map((m) => m.id));
      const fresh = fetched.filter((m) => !known.has(m.id));

      // Keep the thread the user is looking at marked as read
      if (viewingId !== null) {
        const current = fetched.find((m) => m.id === viewingId);
        if (current && current.unreadCount > 0) api.markRead(viewingId).catch(() => {});
      }
      setMatches(fetched.map((m) => (m.id === viewingId ? { ...m, unreadCount: 0 } : m)));

      // A match created by the other person while we were away: same celebration as realtime
      if (matchesLoadedRef.current && fresh.length > 0) {
        setCelebrationMatch((prev) => prev || fresh[0]);
      }
    } catch {
      // Keep the current list; the next tick retries
    }
  }, []);

  const refreshThreadSilently = useCallback(async (matchId: number) => {
    const startedAt = Date.now();
    try {
      const { messages: fetched } = await api.getMessages(matchId);
      if (lastRealtimeEventRef.current > startedAt) return;
      setMessagesByMatch((prev) => {
        // The server copy wins (new messages, read/delivered ticks, messages the other person
        // deleted). Keep only OUR OWN just-sent message that this snapshot may predate.
        const fetchedIds = new Set(fetched.map((m) => m.id));
        const newestFetchedId = fetched.length ? fetched[fetched.length - 1].id : 0;
        const keep = (prev[matchId] || []).filter(
          (m) =>
            !fetchedIds.has(m.id) &&
            m.senderId === profileIdRef.current &&
            m.id > newestFetchedId &&
            Date.now() - new Date(m.createdAt).getTime() < 20_000
        );
        return { ...prev, [matchId]: [...fetched, ...keep] };
      });
    } catch {
      // ignore; next tick retries
    }
  }, []);

  const refreshLive = useCallback(() => {
    refreshMatchesSilently();
    refreshLikes();
    if (activeTabRef.current === 'likes') setLikesRefreshToken((v) => v + 1);
    const viewingId = viewingMatchIdRef.current;
    if (viewingId !== null) refreshThreadSilently(viewingId);
  }, [refreshMatchesSilently, refreshLikes, refreshThreadSilently]);

  const markMatchRead = useCallback((matchId: number) => {
    api.markRead(matchId).catch(() => {});
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, unreadCount: 0 } : m))
    );
  }, []);

  const appendMessageIdempotent = useCallback(
    (matchId: number, incoming: ChatMessage) => {
      setMessagesByMatch((prev) => {
        const list = prev[matchId] || [];
        if (list.some((m) => m.id === incoming.id)) return prev;
        return { ...prev, [matchId]: [...list, incoming] };
      });

      const isViewingThread =
        activeTab === 'matches' && selectedMatchId === matchId;

      setMatches((prev) => {
        const updated = prev.map((m) => {
          if (m.id !== matchId) return m;
          const isFromPartner = incoming.senderId !== profile?.id;
          const nextUnread =
            isFromPartner && !isViewingThread ? m.unreadCount + 1 : 0;
          return {
            ...m,
            updatedAt: incoming.createdAt,
            lastMessage: {
              id: incoming.id,
              senderId: incoming.senderId,
              content: incoming.content,
              createdAt: incoming.createdAt,
              readAt: incoming.readAt,
            },
            unreadCount: nextUnread,
          };
        });
        return updated.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });

      if (incoming.senderId !== profile?.id && isViewingThread) {
        markMatchRead(matchId);
      }
    },
    [activeTab, selectedMatchId, profile?.id, markMatchRead]
  );

  const handleMatchRemoved = useCallback((matchId: number) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    setMessagesByMatch((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    setSelectedMatchId((prev) => (prev === matchId ? null : prev));
    setCelebrationMatch((prev) => (prev?.id === matchId ? null : prev));
  }, []);

  // Live WebSocket connection for real-time 1-on-1 messaging & match updates
  const watchedUserId = selectedMatchId === null
    ? undefined
    : matches.find((match) => match.id === selectedMatchId)?.partner.id;

  const realtimeConnected = useRealtime(Boolean(profile?.isProfileComplete), {
    onMessageCreated: (matchId, message) => {
      lastRealtimeEventRef.current = Date.now();
      appendMessageIdempotent(matchId, message);
    },
    onMessagesRead: (matchId, readerId, readAt) => {
      if (readerId === profile?.id) return;
      setMessagesByMatch((prev) => {
        const list = prev[matchId];
        if (!list) return prev;
        return {
          ...prev,
          [matchId]: list.map((msg) =>
            msg.senderId === profile?.id && !msg.readAt
              ? { ...msg, readAt }
              : msg
          ),
        };
      });
    },
    onMessageDelivered: (matchId, messageId) => {
      setMessagesByMatch((prev) => ({
        ...prev,
        [matchId]: (prev[matchId] || []).map((message) =>
          message.id === messageId ? { ...message, deliveredAt: new Date().toISOString() } : message
        ),
      }));
    },
    onMessageDeleted: (matchId, messageId) => {
      lastRealtimeEventRef.current = Date.now();
      setMessagesByMatch((prev) => ({
        ...prev,
        [matchId]: (prev[matchId] || []).filter((message) => message.id !== messageId),
      }));
      loadMatches();
    },
    onPresenceUpdated: (userId, online) => {
      setOnlineUsers((previous) => ({ ...previous, [userId]: online }));
    },
    onMatchCreated: (match) => {
      lastRealtimeEventRef.current = Date.now();
      setMatches((prev) => {
        if (prev.some((m) => m.id === match.id)) return prev;
        return [match, ...prev];
      });
      setCelebrationMatch((prev) => prev || match);
    },
    onLikesUpdated: () => {
      setLikesRefreshToken((value) => value + 1);
      refreshLikes();
    },
    onMatchRemoved: (matchId) => {
      lastRealtimeEventRef.current = Date.now();
      handleMatchRemoved(matchId);
    },
    onReconnected: () => {
      loadMatches();
      refreshLikes();
      if (selectedMatchId !== null) {
        loadMessages(selectedMatchId).catch(() => {});
      }
    },
  }, watchedUserId);

  // Fallback for hosts without WebSockets: refresh on focus, and poll while the socket is down
  useLiveRefresh({
    enabled: Boolean(profile?.isProfileComplete),
    realtimeConnected,
    onRefresh: refreshLive,
  });

  const handleSendMessage = useCallback(
    async (matchId: number, content: string) => {
      const { message } = await api.sendMessage(matchId, content);
      appendMessageIdempotent(matchId, message);
    },
    [appendMessageIdempotent]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: number) => {
      const { matchId } = await api.deleteMessage(messageId);
      // Apply immediately: without a WebSocket there is no `message:deleted` event to wait for
      setMessagesByMatch((prev) => ({
        ...prev,
        [matchId]: (prev[matchId] || []).filter((message) => message.id !== messageId),
      }));
      refreshMatchesSilently();
    },
    [refreshMatchesSilently]
  );

  const handleOpenMatchChat = useCallback((match: MatchSummary) => {
    setCelebrationMatch(null);
    setMatches((prev) =>
      prev.some((m) => m.id === match.id) ? prev : [match, ...prev]
    );
    setActiveTab('matches');
    setSelectedMatchId(match.id);
  }, []);

  const handleSendMatchIcebreaker = useCallback(
    async (match: MatchSummary, text: string) => {
      const { message } = await api.sendMessage(match.id, text);
      appendMessageIdempotent(match.id, message);
      handleOpenMatchChat(match);
    },
    [appendMessageIdempotent, handleOpenMatchChat]
  );

  // Online = live WebSocket presence, OR the partner made a request within the last minute
  // (their last_seen_at advances on every request, so this also works without WebSockets).
  const watchedPartnerLastSeen = watchedUserId
    ? matches.find((m) => m.partner.id === watchedUserId)?.partner.lastSeenAt
    : null;
  const partnerIsOnline = Boolean(
    watchedUserId &&
      (onlineUsers[watchedUserId] ||
        (watchedPartnerLastSeen &&
          Date.now() - new Date(watchedPartnerLastSeen).getTime() < RECENTLY_ACTIVE_MS))
  );

  const unreadTotal = useMemo(
    () => matches.reduce((sum, m) => sum + (m.unreadCount || 0), 0),
    [matches]
  );

  if (!profile) return null;

  const hideMobileChrome = activeTab === 'matches' && selectedMatchId !== null;

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setActiveTab(tab);
        if (tab !== 'matches') {
          setSelectedMatchId(null);
        }
      }}
      unreadTotal={unreadTotal}
      likesTotal={likesTotal}
      profile={profile}
      onSignOut={signOut}
      hideMobileChrome={hideMobileChrome}
    >
      {activeTab === 'discover' && (
        <DiscoverPage
          onMutualMatch={(match) => setCelebrationMatch(match)}
          onMatchesChanged={loadMatches}
          excludedProfileIds={matches.map((m) => m.partner.id)}
        />
      )}

      {activeTab === 'likes' && (
        <LikesPage
          refreshToken={likesRefreshToken}
          onLikeCountChanged={setLikesTotal}
          onMutualMatch={(match) => setCelebrationMatch(match)}
          onMatchesChanged={loadMatches}
        />
      )}

      {activeTab === 'matches' && (
        <MatchesChatPage
          me={profile}
          matches={matches}
          matchesLoading={matchesLoading}
          matchesError={matchesError}
          selectedMatchId={selectedMatchId}
          messagesByMatch={messagesByMatch}
          onSelectMatch={setSelectedMatchId}
          onRefreshMatches={loadMatches}
          onLoadMessages={loadMessages}
          onSendMessage={handleSendMessage}
          onDeleteMessage={handleDeleteMessage}
          onlinePartner={partnerIsOnline}
          onMarkRead={markMatchRead}
          onMatchRemovedLocally={handleMatchRemoved}
          onGoToDiscover={() => setActiveTab('discover')}
        />
      )}

      {activeTab === 'profile' && <ProfilePage />}

      <MatchCelebrationModal
        match={celebrationMatch}
        me={profile}
        onKeepDiscovering={() => setCelebrationMatch(null)}
        onOpenChat={handleOpenMatchChat}
        onSendIcebreaker={handleSendMatchIcebreaker}
      />
    </AppShell>
  );
}

function NearURouter() {
  const { user, profile, loading, authError, refreshProfile, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0E12] flex flex-col items-center justify-center p-6">
        <span className="font-display text-3xl font-bold tracking-tight text-[#F3F4F6]">
          Near<span className="text-[#E05A6D]">U</span>
        </span>
        <div className="mt-5 w-8 h-8 rounded-full border-2 border-[#2A2B32] border-t-[#E05A6D] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0D0E12] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#121317] border border-[#2A2B32] rounded-3xl p-6 text-center">
          <h1 className="font-display text-xl font-bold text-[#F3F4F6]">
            Unable to load your account
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-2">
            {authError || 'We could not reach the NearU server. Please try again.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={refreshProfile}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E05A6D] hover:bg-[#cf4c5f] text-white text-sm font-semibold cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={signOut}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] text-[#F3F4F6] text-sm font-medium cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile.isVerified) {
    return <CampusVerifyPage />;
  }

  if (!profile.isProfileComplete) {
    return <OnboardingPage />;
  }

  return <AuthenticatedWorkspace key={profile.id} />;
}

export default function App() {
  return (
    <AuthProvider>
      <NearURouter />
    </AuthProvider>
  );
}
