import type { AnimationGroup } from '@babylonjs/core';
import type { LobbyAnimationState } from './protocol';
import { pickAvatarClip } from './avatar-clips';
import type { AvatarRig } from './avatar-factory';
import type { AvatarInstance } from './avatar-instance';
import {
  HumanoidPose,
  RUN_GAIT,
  WALK_GAIT,
  approach,
  cloneGait,
  footContacts,
  gaitFrequency,
  lerpGait,
  writeAirPose,
  writeGaitPose,
  writeIdlePose,
  writeSlidePose,
  type GaitParams,
} from './humanoid-locomotion';
import { applyHumanoidPose } from './humanoid-rig';

/** Nominal speeds used to normalise cadence when a caller reports no velocity. */
const DEFAULT_WALK_SPEED = 10.5;
const DEFAULT_RUN_SPEED = 13.65;

/** Blend times, seconds. Start-up is a touch faster than wind-down. */
const BLEND_IN = 0.11;
const BLEND_OUT = 0.16;
const RUN_BLEND = 0.2;
const AIR_BLEND = 0.07;
const SLIDE_BLEND = 0.12;

/**
 * Legacy 6-pivot fallback (box avatars and GLBs whose skeleton could not be
 * mapped). Character-space angles → local Euler on plain pivot nodes.
 */
function applySimplePose(rig: AvatarRig, pose: HumanoidPose) {
  setPivot(rig, 'torso', pose.pitch('chest') + pose.pitch('spine'), pose.yaw('chest'), pose.roll('chest'));
  setPivot(rig, 'head', pose.pitch('head'), pose.yaw('head'), pose.roll('head'));
  setPivot(rig, 'armL', pose.pitch('upperArmL'), pose.yaw('upperArmL'), pose.roll('upperArmL'));
  setPivot(rig, 'armR', pose.pitch('upperArmR'), pose.yaw('upperArmR'), pose.roll('upperArmR'));
  setPivot(rig, 'legL', pose.pitch('thighL'), pose.yaw('thighL'), pose.roll('thighL'));
  setPivot(rig, 'legR', pose.pitch('thighR'), pose.yaw('thighR'), pose.roll('thighR'));
}

function setPivot(
  rig: AvatarRig,
  limb: 'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR',
  pitch: number,
  yaw: number,
  roll: number,
) {
  const node = rig[limb];
  // Pivots hang down the -Y axis, so a forward swing is a negative X rotation.
  const x = -pitch;
  const y = -yaw;
  const rest = rig.restRotation?.[limb];
  if (rig.boneDriven && rest) {
    node.rotationQuaternion = null;
    node.rotation.set(rest.x + x, rest.y + y, rest.z + roll);
    return;
  }
  node.rotation.set(x, y, roll);
}

export class HumanoidAnimator {
  private time = 0;
  private phase = 0;
  private walkWeight = 0;
  private runWeight = 0;
  private airWeight = 0;
  private slideWeight = 0;
  private speed = 0;
  private pendingContacts = 0;
  private clipStepAcc = 0;
  private slideMode = false;
  private walkSpeedRef = DEFAULT_WALK_SPEED;
  private runSpeedRef = DEFAULT_RUN_SPEED;
  private readonly pose = new HumanoidPose();
  private readonly gait: GaitParams = cloneGait(WALK_GAIT);
  private groups: AnimationGroup[] | null;
  private activeClip: AnimationGroup | null = null;

  constructor(
    private avatar: AvatarInstance,
    animationGroups?: AnimationGroup[],
  ) {
    const groups = animationGroups?.length ? animationGroups : avatar.animationGroups;
    this.groups = groups.length ? groups : null;
  }

  setSlideMode(on: boolean) {
    this.slideMode = on;
  }

  /** Lets cadence be normalised against the lobby's configured move speeds. */
  setSpeedReference(walkSpeed: number, runSpeed: number) {
    if (walkSpeed > 0.1) this.walkSpeedRef = walkSpeed;
    if (runSpeed > 0.1) this.runSpeedRef = runSpeed;
  }

  /**
   * @param speed horizontal speed in units/s; drives stride cadence so the feet
   *              cannot scrub the floor. Omit to fall back to nominal speeds.
   */
  update(dt: number, state: LobbyAnimationState, grounded: boolean, speed?: number) {
    if (this.groups) {
      this.playClip(state);
      return;
    }

    const rig = this.avatar.rig;
    if (!rig) return;
    const humanoid = rig.humanoid ?? null;

    // Unskinned rigid GLB: no limb bones — keep the visual stable.
    if (this.avatar.rigidGlb && !rig.boneDriven) {
      rig.visual.position.y = 0;
      return;
    }

    const step = dt > 0.1 ? 0.1 : dt;
    this.time += step;

    const moving = state === 'walk' || state === 'run';
    const airborne = state === 'jump' || (state === 'fall' && !grounded);
    const running = state === 'run';

    this.walkWeight = approach(this.walkWeight, moving ? 1 : 0, moving ? BLEND_IN : BLEND_OUT, step);
    this.runWeight = approach(this.runWeight, running ? 1 : 0, RUN_BLEND, step);
    this.airWeight = approach(this.airWeight, airborne ? 1 : 0, AIR_BLEND, step);
    this.slideWeight = approach(this.slideWeight, this.slideMode ? 1 : 0, SLIDE_BLEND, step);

    const reference =
      this.walkSpeedRef + (this.runSpeedRef - this.walkSpeedRef) * this.runWeight;
    const measured =
      speed !== undefined
        ? speed
        : moving
          ? running
            ? this.runSpeedRef
            : this.walkSpeedRef
          : 0;
    // Smooth the reported speed so accel/decel does not jitter the cadence.
    this.speed = approach(this.speed, measured, 0.12, step);

    lerpGait(this.gait, WALK_GAIT, RUN_GAIT, this.runWeight);
    const ratio = reference > 0.01 ? this.speed / reference : 0;
    const advance = gaitFrequency(this.speed, reference, this.gait) * step;
    if (this.walkWeight > 0.02) {
      this.pendingContacts += footContacts(this.phase, advance);
      this.phase += advance;
      if (this.phase >= 1 || this.phase < 0) this.phase -= Math.floor(this.phase);
    }

    const groundWeight = (1 - this.airWeight) * (1 - this.slideWeight);
    // Shorter steps at low speed, full stride at cruising speed.
    const strideScale = 0.55 + 0.45 * (ratio < 0.4 ? 0.4 : ratio > 1 ? 1 : ratio);
    const gaitWeight = this.walkWeight * groundWeight * strideScale;

    this.pose.reset();
    writeIdlePose(this.pose, this.time, groundWeight * (1 - this.walkWeight));
    writeGaitPose(this.pose, this.phase, this.gait, gaitWeight);
    if (this.airWeight > 0.002) {
      writeAirPose(this.pose, state === 'jump', this.airWeight * (1 - this.slideWeight));
    }
    if (this.slideWeight > 0.002) writeSlidePose(this.pose, this.slideWeight);

    if (humanoid) {
      applyHumanoidPose(humanoid, this.pose);
    } else {
      applySimplePose(rig, this.pose);
      if (!rig.boneDriven) rig.torso.position.y = 1.18;
    }
    rig.visual.position.y = this.pose.bob;
  }

  /** True on each visual foot plant (walk / run), for footstep audio. */
  takeFootPlant(state: LobbyAnimationState, dt = 1 / 60) {
    if (state !== 'walk' && state !== 'run') {
      this.pendingContacts = 0;
      this.clipStepAcc = 0;
      return false;
    }
    const rig = this.avatar.rig;
    const posed = !this.groups && !(this.avatar.rigidGlb && !rig?.boneDriven);
    if (!posed) {
      this.clipStepAcc += dt;
      const interval = state === 'run' ? 0.28 : 0.42;
      if (this.clipStepAcc >= interval) {
        this.clipStepAcc = 0;
        return true;
      }
      return false;
    }
    if (this.pendingContacts <= 0) return false;
    this.pendingContacts--;
    return this.walkWeight > 0.35;
  }

  private playClip(state: LobbyAnimationState) {
    if (!this.groups) return;
    const match = pickAvatarClip(this.groups, state);

    // No Idle/Jump clip (common for Meshy walk-only packs) → freeze bind pose.
    if (!match) {
      if (!this.activeClip && !this.groups.some((g) => g.isPlaying)) return;
      for (const g of this.groups) {
        if (g.isPlaying) g.stop();
        g.reset();
      }
      this.activeClip = null;
      return;
    }

    if (this.activeClip === match && match.isPlaying) return;

    for (const g of this.groups) {
      if (g === match) continue;
      if (g.isPlaying) g.stop();
    }
    if (!match.isPlaying) match.start(true);
    this.activeClip = match;
  }
}
