import type { TransformNode } from '@babylonjs/core';
import type { AnimationGroup } from '@babylonjs/core';
import type { LobbyAnimationState } from './protocol';
export declare class HumanoidAnimator {
    private root;
    private time;
    private weight;
    private lastSin;
    private clipStepAcc;
    private groups;
    constructor(root: TransformNode, animationGroups?: AnimationGroup[]);
    private slideMode;
    setSlideMode(on: boolean): void;
    update(dt: number, state: LobbyAnimationState, grounded: boolean): void;
    /** True on each visual foot plant (walk / run). */
    takeFootPlant(state: LobbyAnimationState, dt?: number): boolean;
    private playClip;
    private poseIdle;
    private poseLocomotion;
    private poseAir;
    private poseSlide;
}
//# sourceMappingURL=humanoid-animator.d.ts.map