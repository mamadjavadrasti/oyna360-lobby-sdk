import { Mesh, Scene, TransformNode, Vector3 as BVector3 } from '@babylonjs/core';
import type { AnimationGroup, AbstractMesh } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
/** Register Draco decoder so compressed avatar GLBs (KHR_draco_mesh_compression) load. */
import '@babylonjs/core/Meshes/Compression/dracoCompression';
import { type HumanoidBoneRig } from './humanoid-rig';
import type { SdkLobbyAvatar } from './platform-types';
export interface AvatarRig {
    /** Movable node (collider if present, otherwise visual root). */
    root: TransformNode;
    visual: TransformNode;
    collider: Mesh | null;
    torso: TransformNode;
    head: TransformNode;
    armL: TransformNode;
    armR: TransformNode;
    legL: TransformNode;
    legR: TransformNode;
    /** Skinned GLB: pivots are skeleton bones — only rotate, never rewrite bind positions. */
    boneDriven?: boolean;
    /** Full humanoid bone map (spine, knees, elbows…) when the GLB skeleton allows it. */
    humanoid?: HumanoidBoneRig;
    restRotation?: {
        torso: BVector3;
        head: BVector3;
        armL: BVector3;
        armR: BVector3;
        legL: BVector3;
        legR: BVector3;
    };
}
/** Recolor avatar body meshes only — never the nametag billboard. */
export declare function applyAvatarTint(root: TransformNode, hex: string | undefined | null): void;
/** Read base-body albedo: preset colorVariants first, then accessory appliesToBase. */
export declare function readBaseAlbedoUrlFromConfig(customConfig: Record<string, unknown> | undefined | null): string | null;
export declare function applyAvatarBaseAlbedo(root: TransformNode, textureUrl: string | null | undefined): void;
/** Resolve absolute/relative glbUrl from SdkLobbyAvatar (phase A config). */
export { resolveGlbUrl } from './avatar-config';
/**
 * Meshy/glTF looks hollow because albedo PNG alpha + __root__ Z-flip + culling.
 * Force opaque + double-sided. Do not flipFaces, do not replace PBR.
 * Do not forceDepthWrite — that punches holes in the plaza when two avatars overlap.
 */
export declare function hardenAvatarMaterials(meshes: AbstractMesh[]): void;
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
}
//# sourceMappingURL=avatar-factory.d.ts.map