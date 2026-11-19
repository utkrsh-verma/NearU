import React, { useState } from 'react';
import { User } from 'lucide-react';

interface AvatarPhotoProps {
  src?: string | null;
  alt: string;
  name?: string | null;
  className?: string;
  lazy?: boolean;
}

export function AvatarPhoto({
  src,
  alt,
  name,
  className = 'w-full h-full',
  lazy = true,
}: AvatarPhotoProps) {
  const [failed, setFailed] = useState(false);

  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  if (!src || failed) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gradient-to-br from-[#1A1B20] via-[#15161B] to-[#121317] text-[#9CA3AF] select-none`}
        aria-label={alt}
      >
        {initials ? (
          <span className="font-display font-semibold tracking-tight text-lg text-[#F3F4F6]/70">
            {initials}
          </span>
        ) : (
          <User className="w-6 h-6 opacity-50" aria-hidden="true" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : 'eager'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover`}
    />
  );
}
