import type { TransformNode } from '@babylonjs/core';
import type { AnimationGroup } from '@babylonjs/core';
import type { LobbyAnimationState } from './protocol';
import { AvatarFactory, type AvatarRig } from './avatar-factory';

const CLIP_MAP: Record<LobbyAnimationState, string[]> = {
  idle: ['idle', 'Idle'],
  walk: ['walk', 'Walk', 'walking'],
  run: ['run', 'Run', 'sprint', 'Sprint'],
  jump: ['jump', 'Jump'],
  fall: ['fall', 'Fall', 'falling'],
};

export class HumanoidAnimator {
  private time = 0;
  private weight = 0;
  private lastSin = 0;
  private clipStepAcc = 0;
  private groups: AnimationGroup[] | null;

  constructor(
    private root: TransformNode,
    animationGroups?: AnimationGroup[],
  ) {
    this.groups = animationGroups?.length ? animationGroups : null;
  }

  private slideMode = false;

  setSlideMode(on: boolean) {
    this.slideMode = on;
  }

  update(dt: number, state: LobbyAnimationState, grounded: boolean) {
    const rig = AvatarFactory.getRig(this.root);
    if (this.groups) {
      this.playClip(state);
      return;
    }
    if (!rig) return;

    this.time += dt;
    if (this.slideMode) {
      this.poseSlide(rig);
      return;
    }
    const moving = state === 'walk' || state === 'run';
    const targetWeight = moving ? 1 : 0;
    this.weight += (targetWeight - this.weight) * Math.min(1, dt * 10);

    if (state === 'jump' || (state === 'fall' && !grounded)) {
      this.poseAir(rig, state === 'jump');
      return;
    }

    if (this.weight < 0.02) {
      this.poseIdle(rig);
      return;
    }

    const run = state === 'run';
    const freq = run ? 9.2 : 6.2;
    const swing = this.weight * (run ? 0.95 : 0.62);
    const t = this.time * freq;
    this.poseLocomotion(rig, t, swing, run);
  }

  /** True on each visual foot plant (walk / run). */
  takeFootPlant(state: LobbyAnimationState, dt = 1 / 60) {
    if (state !== 'walk' && state !== 'run') {
      this.lastSin = 0;
      this.clipStepAcc = 0;
      return false;
    }
    if (this.groups) {
      this.clipStepAcc += dt;
      const interval = state === 'run' ? 0.28 : 0.42;
      if (this.clipStepAcc >= interval) {
        this.clipStepAcc = 0;
        return true;
      }
      return false;
    }
    const freq = state === 'run' ? 9.2 : 6.2;
    const s = Math.sin(this.time * freq);
    const planted = (this.lastSin <= 0 && s > 0) || (this.lastSin >= 0 && s < 0);
    this.lastSin = s;
    return planted && this.weight > 0.35;
  }

  private playClip(state: LobbyAnimationState) {
    if (!this.groups) return;
    const names = CLIP_MAP[state];
    let match = this.groups.find((g) => names.some((n) => g.name.toLowerCase().includes(n.toLowerCase())));
    if (!match) match = this.groups.find((g) => g.name.toLowerCase().includes('idle')) ?? this.groups[0];
    for (const g of this.groups) {
      if (g === match) {
        if (!g.isPlaying) g.start(true);
      } else if (g.isPlaying) {
        g.stop();
      }
    }
  }

  private poseIdle(rig: AvatarRig) {
    const breathe = Math.sin(this.time * 2.1) * 0.015;
    rig.torso.rotation.x = breathe * 0.4;
    rig.torso.position.y = 1.18 + breathe;
    rig.head.rotation.x = breathe * 0.2;
    rig.armL.rotation.set(0.08, 0, 0.06);
    rig.armR.rotation.set(0.08, 0, -0.06);
    rig.legL.rotation.set(0, 0, 0.02);
    rig.legR.rotation.set(0, 0, -0.02);
    rig.visual.position.y = 0;
  }

  private poseLocomotion(rig: AvatarRig, t: number, swing: number, run: boolean) {
    const leg = Math.sin(t) * swing;
    const arm = Math.sin(t) * swing * (run ? 0.85 : 0.7);
    const bounce = Math.abs(Math.sin(t)) * (run ? 0.055 : 0.03) * this.weight;
    rig.legL.rotation.x = leg;
    rig.legR.rotation.x = -leg;
    rig.armL.rotation.x = -arm;
    rig.armR.rotation.x = arm;
    rig.armL.rotation.z = 0.08;
    rig.armR.rotation.z = -0.08;
    rig.torso.rotation.y = Math.sin(t) * 0.07 * this.weight;
    rig.torso.rotation.x = run ? 0.12 : 0.04;
    rig.torso.position.y = 1.18;
    rig.head.rotation.y = -rig.torso.rotation.y * 0.4;
    rig.visual.position.y = bounce * 0.35;
  }

  private poseAir(rig: AvatarRig, _jumping: boolean) {
    rig.legL.rotation.x = -0.45;
    rig.legR.rotation.x = -0.32;
    rig.armL.rotation.x = 0.35;
    rig.armR.rotation.x = 0.45;
    rig.armL.rotation.z = 0.25;
    rig.armR.rotation.z = -0.25;
    rig.torso.rotation.x = -0.08;
    rig.torso.rotation.y = 0;
    rig.head.rotation.x = 0;
    rig.visual.position.y = 0;
  }

  private poseSlide(rig: AvatarRig) {
    rig.torso.rotation.x = 0.62;
    rig.torso.rotation.z = 0.06;
    rig.head.rotation.x = -0.28;
    rig.armL.rotation.x = 0.95;
    rig.armR.rotation.x = 1.05;
    rig.armL.rotation.z = 0.35;
    rig.armR.rotation.z = -0.35;
    rig.legL.rotation.x = 0.22;
    rig.legR.rotation.x = 0.38;
    rig.legL.rotation.z = 0.08;
    rig.legR.rotation.z = -0.05;
    rig.visual.position.y = -0.04;
  }
}
