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
/** Lobby is lighter than a full match — mobile never starts on the desktop "high" preset. */
export declare function detectLobbyQuality(): LobbyQualityLevel;
export declare function resolveLobbyQuality(quality: LobbyQualityLevel | 'auto' | undefined): LobbyQualityLevel;
export declare function lobbyQualitySettings(quality: LobbyQualityLevel | 'auto' | undefined): LobbyQualitySettings;
/**
 * Extra PBR maps are ~10MB VRAM each unique body. Phones and crowded rooms
 * cannot hold that for dozens of players — albedo alone is enough at lobby scale.
 */
export declare function shouldTrimAvatarDetailMaps(opts: {
    quality: LobbyQualityLevel;
    touch: boolean;
    avatarCount: number;
}): boolean;
export declare function shouldDisableLobbyBloom(opts: {
    quality: LobbyQualityLevel;
    touch: boolean;
    avatarCount: number;
}): boolean;
/** Distance bands for remote avatar animation cadence (simple, not a LOD system). */
export declare const LOBBY_AVATAR_ANIM_FULL_DIST = 20;
export declare const LOBBY_AVATAR_ANIM_HALF_DIST = 34;
export declare const LOBBY_AVATAR_ANIM_QUARTER_DIST = 48;
/**
 * How many frames between remote bone/anim updates.
 * Near avatars stay at 1; far ones skip work without changing movement sync.
 */
export declare function remoteAvatarAnimStride(distSq: number): number;
//# sourceMappingURL=quality.d.ts.map