import type { LobbyAnimationState } from './protocol';
/** Alias lists used to map lobby locomotion → clip names in a GLB. */
export declare const AVATAR_CLIP_ALIASES: Record<LobbyAnimationState, string[]>;
export type NamedClip = {
    name: string;
};
/**
 * Pick the best animation clip for a locomotion state.
 *
 * Important: never fall back idle → walk (Meshy often ships only Walking;
 * playing it while standing looks like the avatar always walks).
 * Returns null when no suitable clip exists — caller should freeze bind pose.
 */
export declare function pickAvatarClip<T extends NamedClip>(clips: readonly T[], state: LobbyAnimationState): T | null;
/** Drop duplicate clip names (Meshy often emits the same anim twice). Keep first. */
export declare function dedupeClipsByName<T extends NamedClip>(clips: readonly T[]): T[];
//# sourceMappingURL=avatar-clips.d.ts.map