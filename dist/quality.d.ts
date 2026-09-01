export type LobbyQualityLevel = 'low' | 'medium' | 'high';
export interface LobbyQualitySettings {
    pixelRatioCap: number;
    antialias: boolean;
    bloom: boolean;
    bloomKernel: number;
    bloomWeight: number;
    fxaa: boolean;
}
export declare const LOBBY_QUALITY: Record<LobbyQualityLevel, LobbyQualitySettings>;
export declare function isTouchDevice(): boolean;
/** Lobby is lighter than a full match — mobile defaults are a step above the game tier. */
export declare function detectLobbyQuality(): LobbyQualityLevel;
export declare function resolveLobbyQuality(quality: LobbyQualityLevel | 'auto' | undefined): LobbyQualityLevel;
export declare function lobbyQualitySettings(quality: LobbyQualityLevel | 'auto' | undefined): LobbyQualitySettings;
//# sourceMappingURL=quality.d.ts.map