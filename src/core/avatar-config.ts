import type { SdkLobbyAvatar } from './platform-types.js';

/** Resolve absolute/relative glbUrl from SdkLobbyAvatar (phase A config). */
export function resolveGlbUrl(avatar: SdkLobbyAvatar): string | null {
  if (avatar.presetKind !== 'glb') return null;
  const config = (avatar.customConfig ?? {}) as Record<string, unknown>;
  const url = config.glbUrl;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

/** Normalize the selected platform clothing texture before converting to AvatarState. */
export function resolveAvatarBaseAlbedoUrl(config: Record<string, unknown> | null | undefined): string | null {
  if (!config) return null;
  const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const explicit = text(config.baseAlbedoUrl);
  if (explicit) return explicit;
  const variants = Array.isArray(config.colorVariants) ? config.colorVariants : [];
  const selectedKey = text(config.colorVariantKey) ?? text(config.defaultColorVariantKey);
  const selected = variants.find((entry) => entry && typeof entry === 'object' && entry.key === selectedKey)
    ?? variants[0];
  if (selected && typeof selected === 'object' && selected.appliesToBase !== false) {
    const url = text(selected.textureUrl);
    if (url) return url;
  }
  const accessories = Array.isArray(config.accessories) ? config.accessories : [];
  for (const entry of accessories) {
    if (entry && typeof entry === 'object' && entry.appliesToBase === true) {
      const url = text(entry.textureUrl);
      if (url) return url;
    }
  }
  return null;
}
