import type { SdkLobbyAvatar } from './platform-types.js';
/** Resolve absolute/relative glbUrl from SdkLobbyAvatar (phase A config). */
export declare function resolveGlbUrl(avatar: SdkLobbyAvatar): string | null;
/** Normalize the selected platform clothing texture before converting to AvatarState. */
export declare function resolveAvatarBaseAlbedoUrl(config: Record<string, unknown> | null | undefined): string | null;
//# sourceMappingURL=avatar-config.d.ts.map