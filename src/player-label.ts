export function formatPlayerHandle(_displayName?: string, username?: string): string {
  return (username?.trim() || 'بازیکن').slice(0, 24);
}

/** 3D name tags: username only. */
export function formatAvatarTagLabel(_displayName?: string, username?: string): string {
  return formatPlayerHandle(undefined, username);
}

export function formatPlayerLabel(displayName?: string, username?: string): string {
  return formatPlayerHandle(displayName, username);
}

export function formatPlayerLabelParts(displayName?: string, username?: string): { title: string; subtitle: string | null } {
  return { title: formatAvatarTagLabel(displayName, username), subtitle: null };
}
