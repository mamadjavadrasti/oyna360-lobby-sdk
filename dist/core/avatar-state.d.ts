import type { LobbyAnimationState, LobbyEmoteKind, LobbyPlayerState } from './protocol.js';
import type { AvatarPresetKind, SdkLobbyAvatar } from './platform-types.js';
import { LobbyEmitter } from './events.js';
/** Renderer-agnostic 3-vector (not Babylon Vector3). */
export type AvatarVec3 = {
    x: number;
    y: number;
    z: number;
};
/**
 * Attachment on the avatar (weapon, prop, etc.).
 * Core state only — no mesh/bone objects.
 */
export type AvatarAttachment = {
    id: string;
    itemId?: string;
    kind?: string;
    assetUrl?: string;
    bone?: string;
    slot?: string;
    position?: AvatarVec3;
    rotation?: AvatarVec3;
    scale?: AvatarVec3;
    metadata?: Record<string, unknown>;
};
/** Equipped cosmetic accessory (hat, pack, …). */
export type AvatarAccessory = {
    id: string;
    itemId?: string;
    kind?: string;
    slot?: string;
    assetUrl?: string;
    metadata?: Record<string, unknown>;
};
/** Appearance / material knobs — strings and URLs only. */
export type AvatarSkin = {
    tint?: string | null;
    bodyColor?: string;
    accentColor?: string;
    pantsColor?: string;
    hairColor?: string;
    /** Clothing / base albedo texture URL (existing customConfig.baseAlbedoUrl). */
    baseAlbedoUrl?: string | null;
    metadata?: Record<string, unknown>;
};
/**
 * Local avatar customization state (Core).
 * Independent of Babylon / protocol wire messages.
 */
export type AvatarState = {
    /** Catalog / preset base id (maps to SdkLobbyAvatar.presetKey when synced to SDK shape). */
    baseId: string;
    modelUrl?: string | null;
    skin?: AvatarSkin | null;
    accessories?: AvatarAccessory[];
    attachments?: AvatarAttachment[];
    animation?: LobbyAnimationState | string | null;
    emote?: LobbyEmoteKind | string | null;
    metadata?: Record<string, unknown>;
};
export type AvatarStateChangeEvent = {
    state: AvatarState;
    reason: string;
};
export type LobbyAvatarEvents = {
    change: AvatarStateChangeEvent;
};
export type SetBaseInput = {
    baseId: string;
    modelUrl?: string | null;
    /** When set, preserved for SdkLobbyAvatar round-trip. */
    presetKind?: AvatarPresetKind;
    presetId?: string;
};
/** Deep-ish clone suitable for getState() snapshots. */
export declare function cloneAvatarState(state: AvatarState): AvatarState;
/**
 * Build AvatarState from platform / protocol SdkLobbyAvatar (local only; no socket).
 */
export declare function avatarStateFromSdk(avatar: SdkLobbyAvatar): AvatarState;
/**
 * Convert AvatarState back to SdkLobbyAvatar for the existing Babylon pipeline.
 * Does not send network messages.
 */
export declare function avatarStateToSdk(state: AvatarState): SdkLobbyAvatar;
/**
 * Phase 0 compatibility: player.avatar as SdkLobbyAvatar view.
 * Prefer AvatarState + LobbyAvatarController for customization.
 */
export type AvatarStateView = SdkLobbyAvatar;
export declare function avatarFromPlayer(player: LobbyPlayerState): AvatarStateView;
/**
 * Local avatar customization API (Core). State-only; no Babylon, no socket sync.
 */
export declare class LobbyAvatarController {
    readonly events: LobbyEmitter<LobbyAvatarEvents>;
    private state;
    constructor(initial: AvatarState);
    static fromSdk(avatar: SdkLobbyAvatar): LobbyAvatarController;
    getState(): AvatarState;
    /** Full replace (tests / advanced). */
    replaceState(next: AvatarState, reason?: string): void;
    setBase(input: SetBaseInput): void;
    setSkin(skin: AvatarSkin | null): void;
    /** Merge partial skin fields into current skin. */
    patchSkin(partial: Partial<AvatarSkin>): void;
    addAccessory(accessory: AvatarAccessory): void;
    removeAccessory(id: string): void;
    attach(attachment: AvatarAttachment): void;
    removeAttachment(id: string): void;
    setAnimation(animation: LobbyAnimationState | string | null): void;
    setEmote(emote: LobbyEmoteKind | string | null): void;
    /** Sdk shape for AvatarFactory / getAvatar() — local only. */
    toSdk(): SdkLobbyAvatar;
    on(event: 'change', handler: (payload: AvatarStateChangeEvent) => void): () => void;
    private emitChange;
}
//# sourceMappingURL=avatar-state.d.ts.map