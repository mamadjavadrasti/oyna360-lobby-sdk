import type { SdkInitPayload, SdkLobbyAvatar, SdkUser, PlatformInitMessage } from './platform-types';

export type { SdkInitPayload, SdkLobbyAvatar, SdkUser, PlatformInitMessage };

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface LobbyThemeConfig {
  groundColor?: string;
  skyColor?: string;
  ambientIntensity?: number;
  fogEnabled?: boolean;
  fogDensity?: number;
}

export interface LobbySpawnConfig {
  spawnPoint?: Vector3;
  spawnPoints?: Vector3[];
}

export interface PlatformLobbyConfig extends LobbyThemeConfig, LobbySpawnConfig {
  groundSize?: number;
  cameraDistance?: number;
  cameraHeight?: number;
  playerSpeed?: number;
  runMultiplier?: number;
  enableMultiplayer?: boolean;
  /** Default true. Live room chat overlay; messages are not stored. */
  enableChat?: boolean;
}

export interface PlatformLobbyCreateOptions {
  canvas: HTMLCanvasElement;
  roomId: string;
  platformInit: SdkInitPayload | PlatformInitMessage;
  config?: PlatformLobbyConfig;
  wsUrl?: string;
}

export interface PlatformLobbyDevOptions {
  canvas: HTMLCanvasElement;
  roomId?: string;
  mockUser?: Partial<SdkUser>;
  mockAvatar?: Partial<SdkLobbyAvatar>;
  config?: PlatformLobbyConfig;
  wsUrl?: string;
  sessionToken?: string;
}

export interface LobbyZoneBounds {
  min: Vector3;
  max: Vector3;
}

export interface LobbyZoneOptions {
  id: string;
  bounds: LobbyZoneBounds;
  onEnter?: (playerId: string) => void;
  onExit?: (playerId: string) => void;
}

export interface LobbyPortalOptions {
  id: string;
  position: Vector3;
  radius?: number;
  label?: string;
  /** Hint for the game (match key, catalog slug, etc.). The SDK never navigates on this. */
  toGameSlug?: string;
  /** Hint for the game's own scene switch. The SDK never changes scenes. */
  toScene?: string;
  /** Game-owned. Called when the local player enters the portal. */
  onTrigger?: () => void;
}

export interface LobbyPlugin {
  name: string;
  setup: (lobby: import('./platform-lobby').PlatformLobby) => void | Promise<void>;
}

export type LobbyEventMap = {
  ready: void;
  destroyed: void;
  playerJoined: { userId: string; displayName: string };
  playerLeft: { userId: string };
  zoneEnter: { zoneId: string; playerId: string };
  zoneExit: { zoneId: string; playerId: string };
  portalTrigger: { portalId: string; toGameSlug?: string; toScene?: string };
  connected: void;
  disconnected: void;
  error: { message: string; code?: string };
  /** Live room chat. Not stored. */
  chat: { userId: string; displayName: string; text: string; at: number };
};

export type LobbyEventName = keyof LobbyEventMap;
