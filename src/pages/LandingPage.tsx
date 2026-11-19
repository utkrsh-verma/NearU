import React from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Lock,
  MessageCircleHeart,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function LandingPage() {
  const { signInWithGoogle, signingIn, authError, clearAuthError } = useAuth();

  return (
    <div className="min-h-screen bg-[#0D0E12] text-[#F3F4F6] flex flex-col relative overflow-x-hidden">
      {/* Subtle atmospheric rose glow behind hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[420px] rounded-full bg-[#E05A6D]/10 blur-[120px]"
      />

      {/* Minimal Top Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8 border-b border-[#2A2B32]/60">
        <span className="font-display text-2xl font-bold tracking-tight text-[#F3F4F6] whitespace-nowrap shrink-0">
          Near<span className="text-[#E05A6D]">U</span>
        </span>
        <span className="text-xs sm:text-sm text-[#9CA3AF] truncate">
          College Exclusive
        </span>
      </header>

      {/* Main Hero 2-Column Split */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-12 lg:py-20 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Editorial Hero & Auth Action */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-sm font-medium text-[#F472B6] mb-4">
              Verified campus community · 18+ only
            </p>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#F3F4F6] leading-[1.08] [text-wrap:balance] max-w-xl">
              Someone closer than you think.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-[#9CA3AF] leading-relaxed max-w-xl">
              Real connections. Right around campus.
            </p>

            {/* Auth Error Banner */}
            {authError && (
              <div
                role="alert"
                className="mt-6 max-w-md rounded-2xl bg-[#1A1B20] border border-[#E05A6D]/50 p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-[#E05A6D] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#F3F4F6] leading-snug">{authError}</p>
                  <button
                    type="button"
                    onClick={clearAuthError}
                    className="mt-1.5 text-xs font-medium text-[#F472B6] hover:underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Primary Google OAuth CTA */}
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={signingIn}
                className="min-h-[54px] px-7 py-3.5 rounded-2xl bg-[#E05A6D] hover:bg-[#cf4c5f] active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-base flex items-center justify-center gap-3 shadow-[0_12px_36px_rgba(224,90,109,0.28)] transition-all cursor-pointer whitespace-nowrap"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1H12v2.92h5.35c-.23 1.48-1.7 4.35-5.35 4.35-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.84 0 3.07.78 3.77 1.46l2.57-2.48C16.7 3.92 14.56 3 12 3 6.98 3 2.92 7.06 2.92 12.08S6.98 21.16 12 21.16c6.93 0 8.63-4.86 8.63-7.38 0-.5-.05-.88-.12-1.26l.84-1.42Z"
                  />
                </svg>
                <span>{signingIn ? 'Signing in...' : 'Continue with Google'}</span>
              </button>
            </div>
          </div>

          {/* Right Editorial Principles Card */}
          <div className="lg:col-span-5 flex">
            <div className="w-full bg-[#121317] border border-[#2A2B32] rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-medium text-[#9CA3AF]">How NearU works</p>
                <h2 className="font-display text-2xl font-semibold text-[#F3F4F6] mt-2">
                  Private by design for campus life.
                </h2>
              </div>

              <div className="divide-y divide-[#2A2B32]/80">
                <div className="py-4 first:pt-1 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#8B5CF6] shrink-0">
                    <BadgeCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-[#F3F4F6]">
                    Verified college students only
                  </h3>
                </div>

                <div className="py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#E05A6D] shrink-0">
                    <MessageCircleHeart className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-[#F3F4F6]">
                    Mutual matches unlock chat
                  </h3>
                </div>

                <div className="py-4 last:pb-1 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#1A1B20] border border-[#2A2B32] flex items-center justify-center text-[#F472B6] shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-[#F3F4F6]">
                    Zero live GPS or last-seen tracking
                  </h3>
                </div>
              </div>

              <div className="pt-4 border-t border-[#2A2B32] flex items-center justify-between text-xs text-[#9CA3AF]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#8B5CF6]" />
                  <span>Campus Verified Community</span>
                </span>
                <span>Discover · Match · Chat</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
