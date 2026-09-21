export type LobbyQualityLevel = 'low' | 'medium' | 'high';

export interface LobbyQualitySettings {
  pixelRatioCap: number;
  antialias: boolean;
  bloom: boolean;
  bloomKernel: number;
  bloomWeight: number;
  fxaa: boolean;
}

export const LOBBY_QUALITY: Record<LobbyQualityLevel, LobbyQualitySettings> = {
  low: {
    pixelRatioCap: 1,
    antialias: false,
    bloom: false,
    bloomKernel: 24,
    bloomWeight: 0.12,
    fxaa: true,
  },
  medium: {
    pixelRatioCap: 1.5,
    antialias: true,
    bloom: true,
    bloomKernel: 28,
    bloomWeight: 0.14,
    fxaa: false,
  },
  high: {
    pixelRatioCap: 2,
    antialias: true,
    bloom: true,
    bloomKernel: 32,
    bloomWeight: 0.18,
    fxaa: false,
  },
};

export function isTouchDevice(): boolean {
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return true;
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return true;
  return false;
}

/** Lobby is lighter than a full match — mobile never starts on the desktop "high" preset. */
export function detectLobbyQuality(): LobbyQualityLevel {
  if (typeof window === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (isTouchDevice()) {
    if (memory <= 2 || cores <= 4) return 'low';
    return 'medium';
  }
  if (cores >= 8 && memory >= 8) return 'high';
  return 'medium';
}

export function resolveLobbyQuality(
  quality: LobbyQualityLevel | 'auto' | undefined,
): LobbyQualityLevel {
  if (quality && quality !== 'auto') return quality;
  return detectLobbyQuality();
}

export function lobbyQualitySettings(
  quality: LobbyQualityLevel | 'auto' | undefined,
): LobbyQualitySettings {
  return LOBBY_QUALITY[resolveLobbyQuality(quality)];
}

/**
 * Extra PBR maps are ~10MB VRAM each unique body. Phones and crowded rooms
 * cannot hold that for dozens of players — albedo alone is enough at lobby scale.
 */
export function shouldTrimAvatarDetailMaps(opts: {
  quality: LobbyQualityLevel;
  touch: boolean;
  avatarCount: number;
}): boolean {
  if (opts.quality === 'low') return true;
  if (opts.touch) return true;
  // Unique Meshy bodies burn VRAM fast once a few different presets show up.
  return opts.avatarCount >= 6;
}

export function shouldDisableLobbyBloom(opts: {
  quality: LobbyQualityLevel;
  touch: boolean;
  avatarCount: number;
}): boolean {
  if (opts.quality === 'low') return true;
  if (opts.touch && opts.avatarCount >= 4) return true;
  return opts.avatarCount >= 10;
}

/** Distance bands for remote avatar animation cadence (simple, not a LOD system). */
export const LOBBY_AVATAR_ANIM_FULL_DIST = 20;
export const LOBBY_AVATAR_ANIM_HALF_DIST = 34;
export const LOBBY_AVATAR_ANIM_QUARTER_DIST = 48;

/**
 * How many frames between remote bone/anim updates.
 * Near avatars stay at 1; far ones skip work without changing movement sync.
 */
export function remoteAvatarAnimStride(distSq: number): number {
  if (distSq <= LOBBY_AVATAR_ANIM_FULL_DIST * LOBBY_AVATAR_ANIM_FULL_DIST) return 1;
  if (distSq <= LOBBY_AVATAR_ANIM_HALF_DIST * LOBBY_AVATAR_ANIM_HALF_DIST) return 2;
  if (distSq <= LOBBY_AVATAR_ANIM_QUARTER_DIST * LOBBY_AVATAR_ANIM_QUARTER_DIST) return 3;
  return 4;
}
