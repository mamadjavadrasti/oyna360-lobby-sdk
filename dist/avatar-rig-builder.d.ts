/**
 * Phase-4: Skeleton / bone / humanoid-rig construction for lobby avatars.
 * Does not own animation, materials, GLB loading, or remote lifecycle.
 */
import { Mesh, Scene, Skeleton, TransformNode, Vector3 as BVector3 } from '@babylonjs/core';
import type { AbstractMesh, AnimationGroup } from '@babylonjs/core';
import { type HumanoidBoneRig } from './humanoid-rig';
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
export type LimbRigPivots = Omit<AvatarRig, 'root' | 'visual' | 'collider'>;
export interface PrepareGlbSkeletonInput {
    scene: Scene;
    name: string;
    glbUrl: string;
    model: TransformNode;
    importRoot: AbstractMesh | TransformNode | undefined;
    rootScaleZ: number;
    meshes: AbstractMesh[];
    transformNodes: TransformNode[];
    skeletons: Skeleton[];
    animationGroups: AnimationGroup[];
}
export interface PrepareGlbSkeletonResult {
    clips: AnimationGroup[];
    displayMeshes: AbstractMesh[];
    rigidGlb: boolean;
    boneDriven: boolean;
    limbRig: LimbRigPivots | null;
    /** Unmodified groups from instantiate (for sourceClips metadata). */
    originalAnimationGroups: AnimationGroup[];
    skeletons: Skeleton[];
    transformNodes: TransformNode[];
}
/** Facade over skeleton / humanoid-rig helpers. */
export declare class AvatarRigBuilder {
    static prepareGlbSkeleton(input: PrepareGlbSkeletonInput): PrepareGlbSkeletonResult;
    static padSkinnedBounds(meshes: AbstractMesh[]): void;
    static preferBoneTexture(skeletons: Skeleton[]): void;
    static bindSkeletonRig(skeletons: Skeleton[], transformNodes: TransformNode[]): LimbRigPivots | null;
    static buildHumanoidAfterFit(visual: TransformNode, skeletons: Skeleton[], transformNodes: TransformNode[], boneDriven: boolean): HumanoidBoneRig | undefined;
    static resolveLimbPivots(scene: Scene, name: string, visual: TransformNode, limbRig: LimbRigPivots | null): Pick<AvatarRig, 'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR'>;
    /**
     * Read the already-built rig from an AvatarInstance / root (creation-time only;
     * never call from the animation/render loop).
     * Accepts AvatarInstance-shaped objects without importing AvatarInstance (avoids cycles).
     */
    static build(instance: {
        readonly root: TransformNode;
        readonly rig?: AvatarRig | null;
    }): AvatarRig | null;
}
//# sourceMappingURL=avatar-rig-builder.d.ts.map