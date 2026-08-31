import { Quaternion, Ray, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, ArcRotateCamera, Mesh, Scene, TransformNode } from '@babylonjs/core';
import type { LobbyAnimationState } from './protocol';
import { AvatarFactory } from './avatar-factory';
import { HumanoidAnimator } from './humanoid-animator';
import type { PlatformLobbyConfig, Vector3 as Vec3 } from './types';
import type { LobbyMusic } from './lobby-music';

const MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
  'Space',
]);

function lerpYaw(current: number, target: number, t: number) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * t;
}

function samplePath(path: Vector3[], t: number) {
  if (path.length === 0) return new Vector3(0, 0, 0);
  if (path.length === 1) return path[0].clone();
  const scaled = t * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = path[i];
  const b = path[i + 1];
  return new Vector3(
    a.x + (b.x - a.x) * f,
    a.y + (b.y - a.y) * f,
    a.z + (b.z - a.z) * f,
  );
}

export class LocalPlayerController {
  private codes = new Set<string>();
  private stickX = 0;
  private stickZ = 0;
  private sprintHeld = false;
  private jumpQueued = false;
  private jumpHeldPointer = false;
  private jumpHeldKey = false;
  private jumpLock = 0;
  private yaw = 0;
  private hVel = new Vector3(0, 0, 0);
  private vy = 0;
  private grounded = true;
  private standY = 0;
  private animation: LobbyAnimationState = 'idle';
  private slideActive = false;
  private slideT = 0;
  private slideDuration = 1;
  private slidePath: Vector3[] = [];
  private onSlideComplete: (() => void) | null = null;
  private readonly walkSpeed: number;
  private readonly runMultiplier: number;
  private readonly animator: HumanoidAnimator;
  private audio: LobbyMusic | null = null;
  private disposed = false;
  private spawn: Vec3;

  constructor(
    private root: TransformNode,
    spawn: Vec3,
    private scene: Scene,
    private getCamera: () => ArcRotateCamera,
    config: PlatformLobbyConfig = {},
  ) {
    this.spawn = { ...spawn };
    this.walkSpeed = config.playerSpeed ?? 6.2;
    this.runMultiplier = config.runMultiplier ?? 1.7;
    this.root.position.set(spawn.x, spawn.y, spawn.z);
    this.animator = new HumanoidAnimator(root);
    this.yaw = 0;
    this.syncVisualYaw();

    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
  }

  setStick(x: number, z: number) {
    const mag = Math.hypot(x, z);
    if (mag > 1) {
      x /= mag;
      z /= mag;
    }
    this.stickX = Math.abs(x) < 0.08 ? 0 : x;
    this.stickZ = Math.abs(z) < 0.08 ? 0 : z;
  }

  setSounds(audio: LobbyMusic) {
    this.audio = audio;
  }

  setSprint(on: boolean) {
    this.sprintHeld = on;
  }

  setJumpHeld(on: boolean) {
    this.jumpHeldPointer = on;
    if (on) this.jumpQueued = true;
  }

  jump() {
    if (this.slideActive) return;
    this.jumpQueued = true;
  }

  isSlideActive() {
    return this.slideActive;
  }

  isGrounded() {
    return this.grounded;
  }

  getVerticalVelocity() {
    return this.vy;
  }

  launchBoost(velocity: number) {
    if (this.slideActive) return;
    this.vy = velocity;
    this.grounded = false;
    this.jumpLock = 0.18;
    this.animation = 'jump';
    this.audio?.playJump();
  }

  startSlide(path: Vec3[], duration: number, onComplete?: () => void) {
    this.slidePath = path.map((p) => new Vector3(p.x, p.y, p.z));
    this.slideT = 0;
    this.slideDuration = Math.max(0.4, duration);
    this.slideActive = true;
    this.onSlideComplete = onComplete ?? null;
    this.codes.clear();
    this.stickX = 0;
    this.stickZ = 0;
    this.sprintHeld = false;
    this.jumpHeldPointer = false;
    this.jumpHeldKey = false;
    this.jumpQueued = false;
    this.hVel.set(0, 0, 0);
    this.vy = 0;
    this.grounded = false;
    if (this.slidePath.length > 0) {
      const start = this.slidePath[0];
      this.root.position.set(start.x, start.y, start.z);
    }
    this.animator.setSlideMode(true);
  }

  private finishSlide() {
    this.slideActive = false;
    this.slidePath = [];
    this.animator.setSlideMode(false);
    this.onSlideComplete?.();
    this.onSlideComplete = null;
    this.refreshGrounded();
    if (this.grounded) this.root.position.y = this.standY;
  }

  private updateSlide(dt: number) {
    this.slideT += dt;
    const t = Math.min(1, this.slideT / this.slideDuration);
    const eased = t * t;
    const pos = samplePath(this.slidePath, eased);
    this.root.position.copyFrom(pos);

    const ahead = samplePath(this.slidePath, Math.min(1, eased + 0.03));
    const dx = ahead.x - pos.x;
    const dz = ahead.z - pos.z;
    if (dx * dx + dz * dz > 0.0001) {
      this.yaw = Math.atan2(dx, dz);
      this.syncVisualYaw();
    }

    this.grounded = false;
    this.animation = 'fall';
    this.animator.update(dt, this.animation, false);

    if (t >= 1) this.finishSlide();
    return this.getState();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      this.jumpHeldKey = true;
      if (!e.repeat) this.jumpQueued = true;
      return;
    }
    if (!MOVE_CODES.has(e.code)) return;
    this.codes.add(e.code);
    e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.codes.delete(e.code);
    if (e.code === 'Space') this.jumpHeldKey = false;
  };

  private onBlur = () => {
    this.codes.clear();
    this.stickX = 0;
    this.stickZ = 0;
    this.sprintHeld = false;
    this.jumpHeldPointer = false;
    this.jumpHeldKey = false;
    this.jumpQueued = false;
  };

  update(dt: number) {
    if (this.disposed) return this.getState();
    if (this.slideActive) return this.updateSlide(dt);

    let inputX = this.stickX;
    let inputZ = this.stickZ;
    if (this.codes.has('KeyW') || this.codes.has('ArrowUp')) inputZ += 1;
    if (this.codes.has('KeyS') || this.codes.has('ArrowDown')) inputZ -= 1;
    if (this.codes.has('KeyA') || this.codes.has('ArrowLeft')) inputX -= 1;
    if (this.codes.has('KeyD') || this.codes.has('ArrowRight')) inputX += 1;

    const running =
      this.sprintHeld || this.codes.has('ShiftLeft') || this.codes.has('ShiftRight');

    const inputLen = Math.hypot(inputX, inputZ);
    if (inputLen > 1) {
      inputX /= inputLen;
      inputZ /= inputLen;
    }

    const cam = this.getCamera();
    const toTarget = cam.getTarget().subtract(cam.position);
    toTarget.y = 0;
    if (toTarget.lengthSquared() < 0.0001) toTarget.set(0, 0, 1);
    toTarget.normalize();
    const right = Vector3.Cross(Vector3.Up(), toTarget);

    const wish = new Vector3(0, 0, 0);
    if (inputLen > 0.001) {
      wish.addInPlace(toTarget.scale(inputZ));
      wish.addInPlace(right.scale(inputX));
      wish.y = 0;
      if (wish.lengthSquared() > 0.0001) wish.normalize();
    }

    const speed = this.walkSpeed * (running && inputLen > 0.2 ? this.runMultiplier : 1);
    const desired = wish.scale(speed);
    const accel = inputLen > 0.001 ? 22 : 18;
    const blend = 1 - Math.exp(-accel * dt);
    this.hVel.x += (desired.x - this.hVel.x) * blend;
    this.hVel.z += (desired.z - this.hVel.z) * blend;
    if (this.hVel.lengthSquared() < 0.002) this.hVel.set(0, 0, 0);

    this.jumpLock = Math.max(0, this.jumpLock - dt);
    this.refreshGrounded();

    const jumpHeld = this.jumpHeldPointer || this.jumpHeldKey;
    if ((this.jumpQueued || jumpHeld) && this.grounded && this.jumpLock <= 0) {
      this.vy = 8.2;
      this.grounded = false;
      this.jumpLock = 0.16;
      this.audio?.playJump();
    }
    this.jumpQueued = false;

    if (!this.grounded) this.vy -= 26 * dt;
    if (this.vy < -28) this.vy = -28;
    if (this.grounded && this.vy < 0) this.vy = 0;

    const walkingOnFloor = this.grounded && this.jumpLock <= 0;
    const disp = new Vector3(
      this.hVel.x * dt,
      walkingOnFloor ? 0 : this.vy * dt,
      this.hVel.z * dt,
    );
    const body = this.root as Mesh;
    if (typeof body.moveWithCollisions === 'function') {
      const len = disp.length();
      const steps = Math.max(1, Math.min(10, Math.ceil(len / 0.16)));
      const step = disp.scale(1 / steps);
      for (let i = 0; i < steps; i++) {
        body.moveWithCollisions(step);
      }
    } else {
      this.root.position.addInPlace(disp);
    }

    const wasAirborne = !this.grounded;
    const fallSpeed = Math.abs(this.vy);
    this.refreshGrounded();
    if (wasAirborne && this.grounded) this.audio?.playLand(fallSpeed);
    if (this.grounded && this.vy < 0) this.vy = 0;
    if (this.grounded && this.jumpLock <= 0) {
      this.root.position.y = this.standY;
      this.vy = 0;
    }

    if (this.root.position.y < -6) {
      this.root.position.set(this.spawn.x, this.spawn.y, this.spawn.z);
      this.hVel.set(0, 0, 0);
      this.vy = 0;
    }

    const moving = this.hVel.length() > 0.35;
    if (moving) {
      const targetYaw = Math.atan2(this.hVel.x, this.hVel.z);
      const turn = 1 - Math.exp(-11 * dt);
      this.yaw = lerpYaw(this.yaw, targetYaw, turn);
      this.syncVisualYaw();
    }

    if (!this.grounded) this.animation = this.vy > 1.2 ? 'jump' : 'fall';
    else if (moving) this.animation = running && inputLen > 0.2 ? 'run' : 'walk';
    else this.animation = 'idle';

    this.animator.update(dt, this.animation, this.grounded);
    if (this.animator.takeFootPlant(this.animation, dt)) {
      this.audio?.playStep(this.animation === 'run');
    }
    return this.getState();
  }

  private isWalkableFloor(name: string) {
    if (name === 'ground' || name === 'grass-ground' || name === 'plaza-pavement') return true;
    if (/^path-\d+$/.test(name)) return true;
    if (
      name === 'playground-slide-deck' ||
      name === 'playground-slide-landing' ||
      name === 'playground-slide-stair-ramp'
    ) {
      return true;
    }
    if (name === 'playground-trampoline-pad') return true;
    if (name.startsWith('playground-slide-step-')) return true;
    return name.startsWith('room-pad-') || name.startsWith('room-inner-');
  }

  private refreshGrounded() {
    if (this.jumpLock > 0 && this.vy > 0) {
      this.grounded = false;
      return;
    }
    const origin = this.root.position.add(new Vector3(0, 1.05, 0));
    const hit = this.scene.pickWithRay(new Ray(origin, Vector3.Down(), 2.1), (mesh) => {
      if (!mesh || mesh === this.root) return false;
      if (mesh.name.startsWith('local-player')) return false;
      return this.isWalkableFloor(mesh.name);
    });
    if (hit?.hit && hit.pickedPoint) {
      const dy = hit.pickedPoint.y - this.root.position.y;
      if (hit.distance <= 1.9 && dy > -0.45 && dy < 0.62) {
        this.grounded = true;
        this.standY = hit.pickedPoint.y;
        return;
      }
    }
    this.grounded = false;
  }

  private syncVisualYaw() {
    const rig = AvatarFactory.getRig(this.root);
    const visual = rig?.visual ?? this.root;
    visual.rotation.set(0, 0, 0);
    visual.rotationQuaternion = Quaternion.RotationYawPitchRoll(this.yaw, 0, 0);
  }

  getState() {
    const p = this.root.position;
    return {
      position: { x: p.x, y: p.y, z: p.z },
      rotationY: this.yaw,
      animation: this.animation,
    };
  }

  getIgnoreMeshes(): AbstractMesh[] {
    const meshes: AbstractMesh[] = [];
    if ('getChildMeshes' in this.root) {
      meshes.push(...(this.root as Mesh).getChildMeshes(false));
    }
    if ((this.root as Mesh).ellipsoid) meshes.push(this.root as Mesh);
    return meshes;
  }

  setPosition(pos: Vec3) {
    this.root.position.set(pos.x, pos.y, pos.z);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.onBlur);
  }
}
