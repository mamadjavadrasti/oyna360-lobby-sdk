import { Scene, TransformNode } from '@babylonjs/core';
import type { AbstractMesh } from '@babylonjs/core';
import { type LobbyQualityLevel } from './quality';
export declare function readTintFromConfig(config: Record<string, unknown> | undefined): string | undefined;
/** Recolor avatar body meshes only — never the nametag billboard. */
export declare function applyAvatarTint(root: TransformNode, hex: string | undefined | null): void;
/** Read base-body albedo: preset colorVariants first, then accessory appliesToBase. */
export declare function readBaseAlbedoUrlFromConfig(customConfig: Record<string, unknown> | undefined | null): string | null;
export declare function applyAvatarBaseAlbedo(root: TransformNode, textureUrl: string | null | undefined): void;
export declare function lobbyQualityOf(scene: Scene): LobbyQualityLevel;
export declare function trimDetailMapsOnMaterials(meshes: AbstractMesh[]): void;
/**
 * Normal and metallic-roughness maps double an avatar's texture memory for
 * detail nobody can see on a phone-sized character. Low-tier devices ran out of
 * GPU memory and lost the WebGL context (a white screen) because of them.
 */
export declare function trimAvatarMapsForLowEndDevices(scene: Scene, meshes: AbstractMesh[]): void;
/**
 * Meshy/glTF looks hollow because albedo PNG alpha + __root__ Z-flip + culling.
 * Force opaque + double-sided. Do not flipFaces, do not replace PBR.
 * Do not forceDepthWrite — that punches holes in the plaza when two avatars overlap.
 */
export declare function hardenAvatarMaterials(meshes: AbstractMesh[]): void;
/** Facade over avatar material / texture helpers. */
export declare class AvatarMaterialPipeline {
    static harden(meshes: AbstractMesh[]): void;
    static applyTint(root: TransformNode, hex: string | undefined | null): void;
    static applyBaseAlbedo(root: TransformNode, textureUrl: string | null | undefined): void;
    static trimForLowEnd(scene: Scene, meshes: AbstractMesh[]): void;
    static trimDetailMapsOnMaterials(meshes: AbstractMesh[]): void;
    static readTintFromConfig(config: Record<string, unknown> | undefined): string | undefined;
    static readBaseAlbedoUrlFromConfig(customConfig: Record<string, unknown> | undefined | null): string | null;
}
//# sourceMappingURL=avatar-material-pipeline.d.ts.map