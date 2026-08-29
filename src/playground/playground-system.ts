import {
  Color4,
  DynamicTexture,
  ParticleSystem,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { PlatformLobby } from '../platform-lobby';
import type { LocalPlayerController } from '../local-player-controller';
import type { Vector3 as Vec3 } from '../types';
import { buildPlayground, buildSlidePath, TRAMPOLINE_ANCHOR } from './playground-layout';

function distXZ(a: Vec3, b: Vec3) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function playBounceSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
    window.setTimeout(() => void ctx.close(), 300);
  } catch {
    /* no audio */
  }
}

export class PlaygroundSystem {
  private slidePrompt = false;
  private sliding = false;
  private trampolineCooldown = 0;
  private trampGlow = 0;
  private trampPulse = 0;
  private ringMat: StandardMaterial | null = null;
  private padMat: StandardMaterial | null = null;
  private particleBurst: ParticleSystem | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private readonly slidePath: Vec3[];

  constructor(private readonly lobby: PlatformLobby) {
    const scene = lobby.getScene();
    buildPlayground(scene, lobby);
    this.slidePath = buildSlidePath();
    this.ringMat = scene.getMaterialByName('pg-tramp-ring-mat') as StandardMaterial | null;
    this.padMat = scene.getMaterialByName('pg-tramp-pad-mat') as StandardMaterial | null;
    this.setupParticles(scene);
    this.setupZones();
    this.setupKeyboard();
    scene.registerBeforeRender(() => this.animate(scene.getEngine().getDeltaTime() * 0.001));
  }

  private setupParticles(scene: Scene) {
    const spark = new DynamicTexture('pg-spark-tex', { width: 32, height: 32 }, scene, false);
    const ctx = spark.getContext() as CanvasRenderingContext2D;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(180,240,255,0.85)');
    grad.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    spark.update();

    const ps = new ParticleSystem('playground-trampoline-burst', 80, scene);
    ps.particleTexture = spark;
    ps.emitter = new Vector3(TRAMPOLINE_ANCHOR.x, 0.55, TRAMPOLINE_ANCHOR.z);
    ps.minEmitBox = new Vector3(-0.8, 0, -0.8);
    ps.maxEmitBox = new Vector3(0.8, 0, 0.8);
    ps.color1 = new Color4(0.2, 0.9, 1, 1);
    ps.color2 = new Color4(0.7, 0.4, 1, 0.9);
    ps.minSize = 0.08;
    ps.maxSize = 0.22;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.55;
    ps.emitRate = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, -4, 0);
    ps.minEmitPower = 2;
    ps.maxEmitPower = 5;
    ps.updateSpeed = 0.02;
    ps.targetStopDuration = 0.35;
    this.particleBurst = ps;
  }

  private setupZones() {
    this.lobby.on('zoneEnter', ({ zoneId }) => {
      if (zoneId === 'playground-slide-prompt') {
        this.slidePrompt = true;
        this.emitPrompt(true);
      }
    });
    this.lobby.on('zoneExit', ({ zoneId }) => {
      if (zoneId === 'playground-slide-prompt') {
        this.slidePrompt = false;
        this.emitPrompt(false);
      }
    });
  }

  private setupKeyboard() {
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (this.trySlide()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  private emitPrompt(show: boolean) {
    this.lobby.emitOverlay('playground-prompt', {
      show,
      text: 'سر بخور! 🛝',
      textEn: 'Press E to Slide',
      action: 'slide',
    });
    this.lobby.emitOverlay('playground-interact', { show, action: 'slide' });
  }

  trySlide(): boolean {
    if (this.sliding || !this.slidePrompt) return false;
    const controller = this.lobby.getLocalController();
    if (controller.isSlideActive()) return false;

    this.sliding = true;
    this.emitPrompt(false);
    controller.startSlide(this.slidePath, 2.05, () => {
      this.sliding = false;
    });
    return true;
  }

  update(dt: number, controller: LocalPlayerController, position: Vec3) {
    this.trampolineCooldown = Math.max(0, this.trampolineCooldown - dt);
    this.trampGlow = Math.max(0, this.trampGlow - dt * 2.2);

    if (!controller.isSlideActive() && this.trampolineCooldown <= 0) {
      const onTramp = distXZ(position, TRAMPOLINE_ANCHOR) < 1.55;
      const grounded = controller.isGrounded();
      const falling = controller.getVerticalVelocity() <= 0.5;
      if (onTramp && grounded && falling) {
        controller.launchBoost(14.5);
        this.trampolineCooldown = 0.45;
        this.trampGlow = 1;
        this.burstParticles();
        playBounceSound();
      }
    }
  }

  private burstParticles() {
    if (!this.particleBurst) return;
    this.particleBurst.emitRate = 120;
    window.setTimeout(() => {
      if (this.particleBurst) this.particleBurst.emitRate = 0;
    }, 120);
  }

  private animate(dt: number) {
    this.trampPulse += dt * 3.2;
    const bounce = 0.38 + Math.sin(this.trampPulse) * 0.025;
    const pad = this.lobby.getScene().getMeshByName('playground-trampoline-pad');
    if (pad) pad.position.y = bounce;

    const glow = 0.55 + this.trampGlow * 0.45 + Math.sin(this.trampPulse * 1.4) * 0.08;
    if (this.ringMat) {
      this.ringMat.emissiveColor.scaleInPlace(0);
      this.ringMat.emissiveColor = this.ringMat.diffuseColor.scale(glow);
    }
    if (this.padMat) {
      this.padMat.emissiveColor = this.padMat.diffuseColor.scale(0.35 + this.trampGlow * 0.5);
    }

    for (let i = 0; i < 6; i++) {
      const orb = this.lobby.getScene().getMeshByName(`playground-trampoline-orb-${i}`);
      if (!orb) continue;
      orb.position.y = 0.55 + Math.sin(this.trampPulse + i * 0.9) * 0.06;
    }
  }

  dispose() {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler, true);
    this.particleBurst?.dispose();
    this.emitPrompt(false);
  }
}

export function attachPlayground(lobby: PlatformLobby) {
  return new PlaygroundSystem(lobby);
}
