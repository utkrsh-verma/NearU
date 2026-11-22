import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCheck,
  Compass,
  Heart,
  MessageCircle,
  MoreVertical,
  Send,
  ShieldAlert,
  UserX,
  Trash2,
} from 'lucide-react';
import { ChatMessage, MatchSummary, MyProfile } from '../types/nearu';
import { api } from '../services/api';
import { buildIcebreakers } from '../lib/constants';
import { AvatarPhoto } from '../components/AvatarPhoto';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface MatchesChatPageProps {
  me: MyProfile;
  matches: MatchSummary[];
  matchesLoading: boolean;
  matchesError: string | null;
  selectedMatchId: number | null;
  messagesByMatch: Record<number, ChatMessage[]>;
  onSelectMatch: (matchId: number | null) => void;
  onRefreshMatches: () => void;
  onLoadMessages: (matchId: number) => Promise<void>;
  onSendMessage: (matchId: number, content: string) => Promise<void>;
  onDeleteMessage: (messageId: number) => Promise<void>;
  onlinePartner: boolean;
  onMarkRead: (matchId: number) => void;
  onMatchRemovedLocally: (matchId: number) => void;
  onGoToDiscover: () => void;
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatListTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function MatchesChatPage({
  me,
  matches,
  matchesLoading,
  matchesError,
  selectedMatchId,
  messagesByMatch,
  onSelectMatch,
  onRefreshMatches,
  onLoadMessages,
  onSendMessage,
  onDeleteMessage,
  onlinePartner,
  onMarkRead,
  onMatchRemovedLocally,
  onGoToDiscover,
}: MatchesChatPageProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'unmatch' | 'block' | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageStreamRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const activeMatch =
    matches.find((m) => m.id === selectedMatchId) || null;
  const activeMessages =
    selectedMatchId !== null ? messagesByMatch[selectedMatchId] || [] : [];

  const newMatches = matches.filter((m) => !m.lastMessage);
  const conversations = matches.filter((m) => Boolean(m.lastMessage));

  // Fetch messages when a match is selected
  useEffect(() => {
    if (selectedMatchId === null) return;
    setMenuOpen(false);
    setChatError(null);
    let cancelled = false;
    setChatLoading(true);
    onLoadMessages(selectedMatchId)
      .then(() => {
        if (!cancelled) shouldAutoScrollRef.current = true;
      })
      .catch((err: any) => {
        if (!cancelled) {
          setChatError(err?.message || 'Conversation is unavailable.');
        }
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMatchId, onLoadMessages, onMarkRead]);

  // Keep readers in place when they scroll back; only follow new messages at the bottom.
  useEffect(() => {
    if (shouldAutoScrollRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, selectedMatchId]);

  // Batch the existing read receipt only after the rendered thread has been visible.
  useEffect(() => {
    if (selectedMatchId === null || chatLoading || activeMessages.length === 0 || document.visibilityState !== 'visible') return;
    const timer = window.setTimeout(() => onMarkRead(selectedMatchId), 300);
    return () => window.clearTimeout(timer);
  }, [selectedMatchId, chatLoading, activeMessages.length, onMarkRead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch || sending) return;
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSending(true);
    setChatError(null);
    setDraft('');
    try {
      await onSendMessage(activeMatch.id, trimmed);
    } catch (err: any) {
      setDraft(trimmed);
      setChatError(err?.message || 'Message failed to send. Please retry.');
    } finally {
      setSending(false);
    }
  };

  const handleIcebreaker = async (text: string) => {
    if (!activeMatch || sending) return;
    setSending(true);
    setChatError(null);
    try {
      await onSendMessage(activeMatch.id, text);
    } catch (err: any) {
      setChatError(err?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleConfirmSafetyAction = async (reason?: string) => {
    if (!activeMatch || !confirmMode) return;
    setConfirmLoading(true);
    setChatError(null);
    try {
      if (confirmMode === 'unmatch') {
        await api.unmatch(activeMatch.id);
      } else {
        await api.blockUser(activeMatch.partner.id, reason);
      }
      onMatchRemovedLocally(activeMatch.id);
      setConfirmMode(null);
      setMenuOpen(false);
    } catch (err: any) {
      setChatError(err?.message || 'Action could not be completed.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!window.confirm('Delete this message for everyone? This cannot be undone.')) return;
    setDeletingMessageId(messageId);
    setChatError(null);
    try {
      await onDeleteMessage(messageId);
    } catch (err: any) {
      setChatError(err?.message || 'Could not delete this message.');
    } finally {
      setDeletingMessageId(null);
    }
  };

  // Close overflow menu on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const showMobileThread = selectedMatchId !== null;

  return (
    <div
      className={`w-full max-w-6xl mx-auto lg:px-8 lg:py-6 flex flex-col ${
        showMobileThread
          ? 'h-[100dvh] lg:h-[calc(100dvh-4rem)]'
          : 'h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-4rem)]'
      }`}
    >
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 lg:gap-6">
        {/* LEFT PANE: Connections List (hidden on mobile when inside an active chat) */}
        <section
          className={`${
            showMobileThread ? 'hidden lg:flex' : 'flex'
          } lg:col-span-4 flex-col min-h-0 lg:bg-[#121317] lg:border lg:border-[#2A2B32] lg:rounded-3xl overflow-hidden`}
        >
          <div className="px-4 sm:px-5 py-4 border-b border-[#2A2B32] flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-[#F3F4F6]">
                Matches
              </h1>
              <p className="text-xs text-[#9CA3AF] tabular-nums">
                {matches.length} active {matches.length === 1 ? 'connection' : 'connections'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {matchesLoading && (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-2xl bg-[#1A1B20] animate-pulse"
                  />
                ))}
              </div>
            )}

            {!matchesLoading && matchesError && (
              <div className="p-6 text-center">
                <AlertCircle className="w-7 h-7 text-[#E05A6D] mx-auto mb-2" />
                <p className="text-sm text-[#9CA3AF]">{matchesError}</p>
                <button
                  type="button"
                  onClick={onRefreshMatches}
                  className="mt-3 text-xs font-semibold text-[#F472B6] hover:underline cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {!matchesLoading && !matchesError && matches.length === 0 && (
              <div className="p-8 text-center my-8">
                <div className="w-12 h-12 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#E05A6D] mx-auto mb-4">
                  <Heart className="w-6 h-6" />
                </div>
                <h2 className="font-display text-lg font-semibold text-[#F3F4F6]">
                  No matches yet
                </h2>
                <p className="text-sm text-[#9CA3AF] mt-1.5 leading-relaxed">
                  When you and another GL Bajaj student like each other, your match and
                  private chat will appear right here.
                </p>
                <button
                  type="button"
                  onClick={onGoToDiscover}
                  className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E05A6D] hover:bg-[#cf4c5f] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>Go to Discover</span>
                </button>
              </div>
            )}

            {!matchesLoading && !matchesError && matches.length > 0 && (
              <>
                {/* New Matches Horizontal Carousel */}
                {newMatches.length > 0 && (
                  <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-[#2A2B32]/70">
                    <p className="text-xs font-medium text-[#9CA3AF] mb-3">
                      New matches
                    </p>
                    <div className="flex items-center gap-3.5 overflow-x-auto pb-1">
                      {newMatches.map((m) => {
                        const isSelected = m.id === selectedMatchId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onSelectMatch(m.id)}
                            className="flex flex-col items-center gap-1.5 shrink-0 w-16 group cursor-pointer"
                          >
                            <div
                              className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition-colors ${
                                isSelected
                                  ? 'border-[#E05A6D]'
                                  : 'border-[#2A2B32] group-hover:border-[#F472B6]'
                              }`}
                            >
                              <AvatarPhoto
                                src={m.partner.photos[0]?.url}
                                alt={m.partner.fullName}
                                name={m.partner.fullName}
                              />
                            </div>
                            <span className="text-xs font-medium text-[#F3F4F6] truncate w-full text-center">
                              {m.partner.fullName.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active Conversations List */}
                <div className="p-2 sm:p-3">
                  <p className="px-2 pt-2 pb-2 text-xs font-medium text-[#9CA3AF]">
                    Conversations
                  </p>
                  {conversations.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-[#9CA3AF]">
                      Tap a new match above to start your first conversation.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((m) => {
                        const isSelected = m.id === selectedMatchId;
                        const last = m.lastMessage;
                        const fromMe = last?.senderId === me.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onSelectMatch(m.id)}
                            className={`w-full min-h-[68px] px-3 py-2.5 rounded-2xl flex items-center gap-3 text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#1A1B20] border border-[#2A2B32]'
                                : 'hover:bg-[#1A1B20]/70 border border-transparent'
                            }`}
                          >
                            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#2A2B32] shrink-0">
                              <AvatarPhoto
                                src={m.partner.photos[0]?.url}
                                alt={m.partner.fullName}
                                name={m.partner.fullName}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-[#F3F4F6] truncate flex items-center gap-1">
                                  <span className="truncate">{m.partner.fullName}</span>
                                  {m.partner.isVerified && (
                                    <BadgeCheck className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                                  )}
                                </span>
                                {last && (
                                  <span className="text-[11px] text-[#9CA3AF] tabular-nums shrink-0">
                                    {formatListTime(last.createdAt)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <p
                                  className={`text-xs truncate ${
                                    m.unreadCount > 0
                                      ? 'text-[#F3F4F6] font-medium'
                                      : 'text-[#9CA3AF]'
                                  }`}
                                >
                                  {last
                                    ? `${fromMe ? 'You: ' : ''}${last.content}`
                                    : 'New match'}
                                </p>
                                {m.unreadCount > 0 && (
                                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#E05A6D] text-white text-[11px] font-semibold flex items-center justify-center tabular-nums shrink-0">
                                    {m.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* RIGHT PANE: Real-Time 1-on-1 Private Chat */}
        <section
          className={`${
            showMobileThread ? 'flex' : 'hidden lg:flex'
          } lg:col-span-8 flex-col min-h-0 bg-[#0D0E12] lg:bg-[#121317] lg:border lg:border-[#2A2B32] lg:rounded-3xl overflow-hidden`}
        >
          {!activeMatch ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#9CA3AF] mb-4">
                <MessageCircle className="w-7 h-7" />
              </div>
              <h2 className="font-display text-xl font-semibold text-[#F3F4F6]">
                Select a conversation
              </h2>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 sm:px-5 h-16 border-b border-[#2A2B32] bg-[#121317] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectMatch(null)}
                    aria-label="Back to matches"
                    className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-[#F3F4F6]"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#2A2B32] shrink-0">
                    <AvatarPhoto
                      src={activeMatch.partner.photos[0]?.url}
                      alt={activeMatch.partner.fullName}
                      name={activeMatch.partner.fullName}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-display text-base font-semibold text-[#F3F4F6] truncate">
                        {activeMatch.partner.fullName}
                        {activeMatch.partner.age ? `, ${activeMatch.partner.age}` : ''}
                      </h2>
                      {activeMatch.partner.isVerified && (
                        <BadgeCheck className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#9CA3AF] truncate">
                      {onlinePartner ? (
                        <span className="text-[#4ADE80]">● Online</span>
                      ) : (
                        [
                          activeMatch.partner.branch,
                          activeMatch.partner.batchYear ? `Batch ${activeMatch.partner.batchYear}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      )}
                    </p>
                  </div>
                </div>

                {/* Overflow Safety Controls (Unmatch / Block) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-label="Conversation options"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1A1B20] transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-[#1A1B20] border border-[#2A2B32] shadow-2xl p-1.5 z-30">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmMode('unmatch');
                          }}
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-sm text-[#F3F4F6] hover:bg-[#2A2B32] flex items-center gap-2.5 cursor-pointer"
                        >
                          <UserX className="w-4 h-4 text-[#9CA3AF]" />
                          <span>Unmatch</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmMode('block');
                          }}
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-sm text-[#E05A6D] hover:bg-[#2A2B32] flex items-center gap-2.5 cursor-pointer"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          <span>Block &amp; Report</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Messages Stream */}
              <div ref={messageStreamRef} onScroll={(event) => {
                const node = event.currentTarget;
                shouldAutoScrollRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
              }} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3">
                {chatError && (
                  <div
                    role="alert"
                    className="rounded-2xl bg-[#1A1B20] border border-[#E05A6D]/50 p-3.5 flex items-center gap-2.5 text-sm text-[#F3F4F6]"
                  >
                    <AlertCircle className="w-4 h-4 text-[#E05A6D] shrink-0" />
                    <span>{chatError}</span>
                  </div>
                )}

                {chatLoading && activeMessages.length === 0 ? (
                  <div className="space-y-3 py-4">
                    <div className="h-10 w-48 bg-[#1A1B20] rounded-2xl animate-pulse" />
                    <div className="h-10 w-56 bg-[#1A1B20] rounded-2xl ml-auto animate-pulse" />
                  </div>
                ) : activeMessages.length === 0 ? (
                  /* Empty Conversation State with Campus Icebreakers */
                  <div className="max-w-md mx-auto py-8 text-center">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#2A2B32] mx-auto mb-3">
                      <AvatarPhoto
                        src={activeMatch.partner.photos[0]?.url}
                        alt={activeMatch.partner.fullName}
                        name={activeMatch.partner.fullName}
                      />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#F3F4F6]">
                      Say hi to {activeMatch.partner.fullName.split(' ')[0]}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1">
                      You matched on{' '}
                      {new Date(activeMatch.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                      . Pick a quick campus icebreaker or write your own note below.
                    </p>
                    <div className="mt-5 space-y-2 text-left">
                      {buildIcebreakers(activeMatch.sharedInterests).map((line) => (
                        <button
                          key={line}
                          type="button"
                          disabled={sending}
                          onClick={() => handleIcebreaker(line)}
                          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] hover:border-[#E05A6D]/60 text-sm text-[#F3F4F6] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                        >
                          <span>{line}</span>
                          <Send className="w-3.5 h-3.5 text-[#E05A6D] shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isMine = msg.senderId === me.id;
                    return (
                      <div
                        key={msg.id}
                        className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-start gap-1.5 max-w-[90%] sm:max-w-[75%]">
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                            isMine
                              ? 'bg-[#E05A6D] text-white rounded-br-md'
                              : 'bg-[#1A1B20] border border-[#2A2B32] text-[#F3F4F6] rounded-bl-md'
                          }`}
                        >
                          {msg.content}
                        </div>
                        {isMine && (
                          <button type="button" onClick={() => handleDeleteMessage(msg.id)} disabled={deletingMessageId === msg.id} aria-label="Delete message" className="w-7 h-7 mt-1 rounded-lg text-[#9CA3AF] hover:text-[#E05A6D] hover:bg-[#1A1B20] flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-40">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        </div>
                        <div className="mt-1 px-1 flex items-center gap-1 text-[11px] text-[#9CA3AF] tabular-nums">
                          <span>{formatMessageTime(msg.createdAt)}</span>
                          {isMine &&
                            (msg.readAt ? (
                              <CheckCheck
                                className="w-3.5 h-3.5 text-[#60A5FA]"
                                aria-label="Seen"
                              />
                            ) : msg.deliveredAt ? (
                              <CheckCheck className="w-3.5 h-3.5" aria-label="Delivered" />
                            ) : (
                              <Check className="w-3.5 h-3.5" aria-label="Sent" />
                            ))}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Text-Only Message Composer (V1 Scope) */}
              <form
                onSubmit={handleSubmit}
                className="p-3 sm:p-4 border-t border-[#2A2B32] bg-[#121317] pb-safe shrink-0"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    maxLength={1000}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Message ${activeMatch.partner.fullName.split(' ')[0]}...`}
                    className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1A1B20] border border-[#2A2B32] focus:border-[#E05A6D] focus:outline-none text-sm text-[#F3F4F6] placeholder:text-[#9CA3AF]/70"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    aria-label="Send message"
                    className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-[#E05A6D] hover:bg-[#cf4c5f] disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmMode !== null}
        mode={confirmMode || 'unmatch'}
        targetName={activeMatch?.partner.fullName || 'this student'}
        loading={confirmLoading}
        onCancel={() => setConfirmMode(null)}
        onConfirm={handleConfirmSafetyAction}
      />
    </div>
  );
}
