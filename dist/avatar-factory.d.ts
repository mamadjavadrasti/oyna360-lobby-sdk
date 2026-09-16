import { Scene, TransformNode } from '@babylonjs/core';
import type { AnimationGroup } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
/** Register Draco decoder so compressed avatar GLBs (KHR_draco_mesh_compression) load. */
import '@babylonjs/core/Meshes/Compression/dracoCompression';
import type { SdkLobbyAvatar } from './platform-types';
import { AvatarInstance } from './avatar-instance';
import { applyAvatarBaseAlbedo, applyAvatarTint, hardenAvatarMaterials, readBaseAlbedoUrlFromConfig } from './avatar-material-pipeline';
import { type AvatarRig } from './avatar-rig-builder';
export type { AvatarRig } from './avatar-rig-builder';
export { AvatarRigBuilder } from './avatar-rig-builder';
export { applyAvatarTint, applyAvatarBaseAlbedo, readBaseAlbedoUrlFromConfig, hardenAvatarMaterials, };
/** Resolve absolute/relative glbUrl from SdkLobbyAvatar (phase A config). */
export { resolveGlbUrl } from './avatar-config';
export declare class AvatarFactory {
    static create(scene: Scene, avatar: SdkLobbyAvatar, name?: string, displayName?: string, username?: string, options?: {
        collider?: boolean | 'player' | 'body';
        skipNameTag?: boolean;
    }): TransformNode;
    /** Procedural sync create, or GLB load when presetKind is glb + glbUrl. */
    static createAsync(scene: Scene, avatar: SdkLobbyAvatar, name?: string, displayName?: string, username?: string, options?: {
        collider?: boolean | 'player' | 'body';
        skipAccessories?: boolean;
        skipNameTag?: boolean;
    }): Promise<TransformNode>;
    static markLobbyAvatar(root: TransformNode, scene: Scene): void;
    /**
     * Recount avatars and drop extra PBR maps / bloom once the room fills up.
     * Safe to call after spawn or dispose.
     */
    static syncCrowdBudget(scene: Scene): void;
    /** Re-tint materials without reloading the GLB (legacy / procedural). */
    static setTint(root: TransformNode, hex: string | undefined | null): void;
    /** Swap base albedo without reloading the GLB (clothing texture variants). */
    static setBaseAlbedo(root: TransformNode, textureUrl: string | undefined | null): void;
    private static createFromGlb;
    static getRig(root: TransformNode): AvatarRig | null;
    static getAnimationGroups(root: TransformNode): AnimationGroup[] | undefined;
    static setPosition(root: TransformNode, position: {
        x: number;
        y: number;
        z: number;
    }): void;
    static setRotationY(root: TransformNode, rotationY: number): void;
    /** Phase-1: wrap a factory-built root as AvatarInstance (no rebuild). */
    static wrap(root: TransformNode): AvatarInstance;
    /**
     * Phase-1 high-level spawn API for remotes/controllers.
     * Builds a procedural stand-in without exposing GLB/material details to callers.
     */
    static createPlaceholderInstance(scene: Scene, avatar: SdkLobbyAvatar, name: string, displayName?: string, username?: string, options?: {
        collider?: boolean | 'player' | 'body';
        skipNameTag?: boolean;
    }): AvatarInstance;
    /**
     * Phase-1 high-level spawn API — same pipeline as createAsync, returns AvatarInstance.
     */
    static createInstanceAsync(scene: Scene, avatar: SdkLobbyAvatar, name?: string, displayName?: string, username?: string, options?: {
        collider?: boolean | 'player' | 'body';
        skipAccessories?: boolean;
        skipNameTag?: boolean;
    }): Promise<AvatarInstance>;
}
//# sourceMappingURL=avatar-factory.d.ts.map