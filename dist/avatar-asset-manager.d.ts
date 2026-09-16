/**
 * Avatar GLB asset loading + per-scene container cache + clone/instantiate.
 * Moved verbatim from AvatarFactory (phase-2 isolation). No behavior changes.
 */
import { Scene, Skeleton, TransformNode } from '@babylonjs/core';
import type { AbstractMesh, AnimationGroup, AssetContainer } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import '@babylonjs/core/Meshes/Compression/dracoCompression';
/** Same file on :3000/uploads vs :3001/uploads must share one GPU/container copy. */
export declare function assetCacheKey(url: string): string;
export interface GlbInstance {
    meshes: AbstractMesh[];
    transformNodes: TransformNode[];
    skeletons: Skeleton[];
    animationGroups: AnimationGroup[];
}
/** Stable catalog entry for a shared base GLB (tint/accessories apply later on instances). */
export interface AvatarBaseDef {
    id: string;
    glbUrl: string;
}
export declare class AvatarAssetManager {
    /** Load (or cache-hit) + clone one avatar GLB instance into the scene. */
    static instantiateAvatarGlb(scene: Scene, glbUrl: string): Promise<GlbInstance>;
    /** Expose container load for diagnostics/tests — same cache as instantiate. */
    static loadContainer(scene: Scene, glbUrl: string): Promise<AssetContainer>;
    /**
     * Warm the per-scene container cache for an arbitrary GLB URL (no registry required).
     * Non-throwing — used when a remote joins with a base that was not pre-registered.
     */
    static warmGlbUrl(scene: Scene, glbUrl: string): Promise<AssetContainer | null>;
    /** Register / replace a base avatar catalog entry (id → glbUrl). */
    static registerAvatarBase(def: AvatarBaseDef): void;
    static registerAvatarBases(defs: readonly AvatarBaseDef[]): void;
    static getAvatarBase(id: string): AvatarBaseDef | undefined;
    static listAvatarBases(): AvatarBaseDef[];
    /** True when this scene already has a (pending or resolved) container promise for the URL. */
    static isContainerCached(scene: Scene, glbUrl: string): boolean;
    static isAvatarBaseCached(scene: Scene, id: string): boolean;
    /**
     * Warm the shared glbContainerCache for a registered base.
     * Reuses loadGlbContainer — no duplicate parse path. Failures resolve to null (non-throwing).
     */
    static preloadAvatarBase(scene: Scene, id: string): Promise<AssetContainer | null>;
    /**
     * Preload one or more bases. Omitting ids preloads the full registry.
     * Uses Promise.allSettled semantics per id (one failure does not abort others).
     */
    static preloadAvatarBases(scene: Scene, ids?: readonly string[]): Promise<Array<{
        id: string;
        ok: boolean;
    }>>;
}
//# sourceMappingURL=avatar-asset-manager.d.ts.map