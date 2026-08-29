import type { SdkInitPayload, SdkLobbyAvatar, SdkUser } from '@platform/types';
import type { PlatformInitMessage } from '@platform/types';
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
    toGameSlug?: string;
    toScene?: string;
    onTrigger?: () => void;
}
export interface LobbyPlugin {
    name: string;
    setup: (lobby: import('./platform-lobby').PlatformLobby) => void | Promise<void>;
}
export type LobbyEventMap = {
    ready: void;
    destroyed: void;
    playerJoined: {
        userId: string;
        displayName: string;
    };
    playerLeft: {
        userId: string;
    };
    zoneEnter: {
        zoneId: string;
        playerId: string;
    };
    zoneExit: {
        zoneId: string;
        playerId: string;
    };
    portalTrigger: {
        portalId: string;
        toGameSlug?: string;
        toScene?: string;
    };
    connected: void;
    disconnected: void;
    error: {
        message: string;
        code?: string;
    };
};
export type LobbyEventName = keyof LobbyEventMap;
//# sourceMappingURL=types.d.ts.map