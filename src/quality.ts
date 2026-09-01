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

/** Lobby is lighter than a full match — mobile defaults are a step above the game tier. */
export function detectLobbyQuality(): LobbyQualityLevel {
  if (typeof window === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (isTouchDevice()) {
    if (cores >= 6 && memory >= 4) return 'high';
    if (cores >= 4 || memory >= 3) return 'medium';
    return 'low';
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
