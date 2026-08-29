import type { PlatformLobby } from './platform-lobby';
export type LobbyCameraPreset = 'default' | 'overview' | 'portal';
export interface LobbyDebugCheck {
    name: string;
    pass: boolean;
    detail?: string;
}
export interface LobbyDebugReport {
    ready: boolean;
    timestamp: string;
    roomId: string;
    gameSlug: string;
    meshCount: number;
    meshNames: string[];
    lightCount: number;
    playerPosition: {
        x: number;
        y: number;
        z: number;
    };
    hasStarterLayout: boolean;
    checks: LobbyDebugCheck[];
    pass: boolean;
}
export declare function setLobbyCameraPreset(lobby: PlatformLobby, preset: LobbyCameraPreset): void;
export declare function buildLobbyDebugReport(lobby: PlatformLobby): LobbyDebugReport;
export interface LobbyDebugHandle {
    ready: boolean;
    getReport: () => LobbyDebugReport;
    setCamera: (preset: LobbyCameraPreset) => void;
    captureScreenshot: () => string | null;
}
declare global {
    interface Window {
        __PLAYHUB_LOBBY_DEBUG__?: LobbyDebugHandle;
    }
}
export declare function attachLobbyDebug(lobby: PlatformLobby, win?: Window): LobbyDebugHandle;
//# sourceMappingURL=lobby-debug.d.ts.map