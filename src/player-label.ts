export function formatPlayerLabel(displayName?: string, username?: string): string {
  const name = (displayName?.trim() || username?.trim() || 'بازیکن').slice(0, 24);
  const id = username?.trim().slice(0, 20) ?? '';
  if (!id || id === name) return name;
  return `${name} · ${id}`;
}

export function formatPlayerLabelParts(displayName?: string, username?: string): { title: string; subtitle: string | null } {
  const title = (displayName?.trim() || username?.trim() || 'بازیکن').slice(0, 22);
  const id = username?.trim().slice(0, 18) ?? '';
  if (!id || id === title) return { title, subtitle: null };
  return { title, subtitle: `@${id}` };
}
