export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'Weeks ago';
  const elapsed = Math.max(0, Date.now() - new Date(lastSeenAt).getTime());
  const hours = elapsed / 3_600_000;
  if (hours < 1) return 'Less than an hour ago';
  if (hours < 6) return '6 hours ago';
  if (hours < 12) return '12 hours ago';
  if (hours < 24 * 7) return '1 day ago';
  return 'Weeks ago';
}
