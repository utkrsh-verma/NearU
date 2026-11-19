import React from 'react';
import { Flame, LogOut, MessageCircle, User } from 'lucide-react';
import { AppTab, MyProfile } from '../types/nearu';
import { AvatarPhoto } from '../components/AvatarPhoto';

interface AppShellProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  unreadTotal: number;
  profile: MyProfile;
  onSignOut: () => void;
  hideMobileChrome?: boolean;
  children: React.ReactNode;
}

export function AppShell({
  activeTab,
  onSelectTab,
  unreadTotal,
  profile,
  onSignOut,
  hideMobileChrome = false,
  children,
}: AppShellProps) {
  const navItems: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'discover', label: 'Discover', icon: Flame },
    { id: 'matches', label: 'Matches', icon: MessageCircle },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#0D0E12] text-[#F3F4F6] flex flex-col">
      {/* Desktop Top Navigation Bar (Strict 3-zone contract) */}
      <header className="hidden lg:block sticky top-0 z-30 bg-[#0D0E12]/90 backdrop-blur-md border-b border-[#2A2B32]">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('discover')}
            className="font-display text-2xl font-bold tracking-tight text-[#F3F4F6] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Near<span className="text-[#E05A6D]">U</span>
          </button>

          {/* Zone 2: Clean typographic nav links */}
          <nav className="flex items-center gap-8" aria-label="Primary navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'text-[#F3F4F6]'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.id === 'matches' && unreadTotal > 0 && (
                    <span className="text-xs font-semibold text-[#F472B6] tabular-nums">
                      ({unreadTotal})
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -bottom-[19px] inset-x-0 h-0.5 bg-[#E05A6D]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary profile/logout action */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('profile')}
              className="w-9 h-9 rounded-full overflow-hidden border border-[#2A2B32] hover:border-[#E05A6D] transition-colors shrink-0 cursor-pointer"
              aria-label="Open your profile"
            >
              <AvatarPhoto
                src={profile.photos[0]?.url}
                alt={profile.fullName || 'Your avatar'}
                name={profile.fullName}
              />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1A1B20] border border-[#2A2B32] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Top App Bar (hidden inside full-screen mobile chat) */}
      {!hideMobileChrome && (
        <header className="lg:hidden sticky top-0 z-30 h-14 px-4 bg-[#0D0E12]/90 backdrop-blur-md border-b border-[#2A2B32] flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectTab('discover')}
            className="font-display text-xl font-bold tracking-tight text-[#F3F4F6] whitespace-nowrap"
          >
            Near<span className="text-[#E05A6D]">U</span>
          </button>
          <span className="text-xs text-[#9CA3AF] truncate max-w-[180px]">
            Campus Verified
          </span>
        </header>
      )}

      {/* Main Content Workspace */}
      <main
        className={`flex-1 w-full ${
          hideMobileChrome ? '' : 'pb-20 lg:pb-8'
        }`}
      >
        {children}
      </main>

      {/* Mobile Bottom Tab Bar (3 primary destinations: Discover, Matches, Profile) */}
      {!hideMobileChrome && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121317]/95 backdrop-blur-md border-t border-[#2A2B32] pb-safe"
        >
          <div className="grid grid-cols-3 h-16 items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isActive ? 'text-[#E05A6D]' : 'text-[#9CA3AF]'
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {item.id === 'matches' && unreadTotal > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E05A6D] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                        {unreadTotal > 9 ? '9+' : unreadTotal}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium tracking-tight">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
