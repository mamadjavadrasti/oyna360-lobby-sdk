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

function applyLimbRotation(
  rig: AvatarRig,
  limb: 'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR',
  dx: number,
  dy = 0,
  dz = 0,
) {
  const node = rig[limb];
  const rest = rig.restRotation?.[limb];
  if (rig.boneDriven && rest) {
    node.rotationQuaternion = null;
    node.rotation.set(rest.x + dx, rest.y + dy, rest.z + dz);
    return;
  }
  node.rotation.set(dx, dy, dz);
}

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

    // Unskinned rigid GLB: no limb bones — keep visual stable.
    if (this.root.metadata?.rigidGlb && !rig.boneDriven) {
      rig.visual.position.y = 0;
      return;
    }

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
    if (this.root.metadata?.rigidGlb && !AvatarFactory.getRig(this.root)?.boneDriven) {
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
    applyLimbRotation(rig, 'torso', breathe * 0.4, 0, 0);
    if (!rig.boneDriven) {
      rig.torso.position.y = 1.18 + breathe;
    }
    applyLimbRotation(rig, 'head', breathe * 0.2, 0, 0);
    applyLimbRotation(rig, 'armL', 0.08, 0, 0.06);
    applyLimbRotation(rig, 'armR', 0.08, 0, -0.06);
    applyLimbRotation(rig, 'legL', 0, 0, 0.02);
    applyLimbRotation(rig, 'legR', 0, 0, -0.02);
    rig.visual.position.y = 0;
  }

  private poseLocomotion(rig: AvatarRig, t: number, swing: number, run: boolean) {
    const leg = Math.sin(t) * swing;
    const arm = Math.sin(t) * swing * (run ? 0.85 : 0.7);
    const bounce = Math.abs(Math.sin(t)) * (run ? 0.055 : 0.03) * this.weight;
    const torsoYaw = Math.sin(t) * 0.07 * this.weight;
    applyLimbRotation(rig, 'legL', leg, 0, 0);
    applyLimbRotation(rig, 'legR', -leg, 0, 0);
    applyLimbRotation(rig, 'armL', -arm, 0, 0.08);
    applyLimbRotation(rig, 'armR', arm, 0, -0.08);
    applyLimbRotation(rig, 'torso', run ? 0.12 : 0.04, torsoYaw, 0);
    if (!rig.boneDriven) {
      rig.torso.position.y = 1.18;
    }
    applyLimbRotation(rig, 'head', 0, -torsoYaw * 0.4, 0);
    rig.visual.position.y = bounce * 0.35;
  }

  private poseAir(rig: AvatarRig, _jumping: boolean) {
    applyLimbRotation(rig, 'legL', -0.45, 0, 0);
    applyLimbRotation(rig, 'legR', -0.32, 0, 0);
    applyLimbRotation(rig, 'armL', 0.35, 0, 0.25);
    applyLimbRotation(rig, 'armR', 0.45, 0, -0.25);
    applyLimbRotation(rig, 'torso', -0.08, 0, 0);
    applyLimbRotation(rig, 'head', 0, 0, 0);
    rig.visual.position.y = 0;
  }

  private poseSlide(rig: AvatarRig) {
    applyLimbRotation(rig, 'torso', 0.62, 0, 0.06);
    applyLimbRotation(rig, 'head', -0.28, 0, 0);
    applyLimbRotation(rig, 'armL', 0.95, 0, 0.35);
    applyLimbRotation(rig, 'armR', 1.05, 0, -0.35);
    applyLimbRotation(rig, 'legL', 0.22, 0, 0.08);
    applyLimbRotation(rig, 'legR', 0.38, 0, -0.05);
    rig.visual.position.y = -0.04;
  }
}
