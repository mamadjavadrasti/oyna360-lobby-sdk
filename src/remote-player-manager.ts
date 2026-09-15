import { Vector3 } from '@babylonjs/core';
import type { AbstractMesh, Camera, Scene, TransformNode } from '@babylonjs/core';
import type { LobbyAnimationState, LobbyEmoteKind, LobbyPlayerState } from './protocol';
import { AvatarFactory } from './avatar-factory';
import { HumanoidAnimator } from './humanoid-animator';
import { removeCharacterObstacle, syncCharacterObstacle } from './lobby-colliders';
import { remoteAvatarAnimStride } from './quality';
import { isLobbyPerfDiagEnabled, lobbyPerfMark, lobbyPerfNoteRemoteUpdate } from './lobby-perf-diag';

function isAir(animation: LobbyAnimationState) {
  return animation === 'jump' || animation === 'fall';
}

/** Cheap behind-camera test — skip anim work when the player is not on screen. */
function isRoughlyBehindCamera(camera: Camera, worldX: number, worldZ: number): boolean {
  const cam = camera.globalPosition;
  const dx = worldX - cam.x;
  const dz = worldZ - cam.z;
  const distSq = dx * dx + dz * dz;
  if (distSq < 16) return false;
  const inv = 1 / Math.sqrt(distSq);
  const forward = camera.getDirection(Vector3.Forward());
  const fx = forward.x;
  const fz = forward.z;
  const flen = Math.hypot(fx, fz);
  if (flen < 1e-5) return false;
  const dot = (fx / flen) * (dx * inv) + (fz / flen) * (dz * inv);
  return dot < -0.12;
}

function yieldToRenderLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      return;
    }
    setTimeout(resolve, 0);
  });
}

/** Lightweight procedural stand-in so remotes appear before GLB parse. */
function placeholderAvatar(player: LobbyPlayerState): LobbyPlayerState['avatar'] {
  const cfg = (player.avatar.customConfig ?? {}) as Record<string, unknown>;
  return {
    presetId: player.avatar.presetId || 'remote-placeholder',
    presetKey: 'remote-placeholder',
    presetKind: 'procedural',
    customConfig: {
      bodyColor: typeof cfg.bodyColor === 'string' ? cfg.bodyColor : '#64748b',
      accentColor: typeof cfg.accentColor === 'string' ? cfg.accentColor : '#cbd5e1',
      pantsColor: typeof cfg.pantsColor === 'string' ? cfg.pantsColor : '#334155',
      hairColor: typeof cfg.hairColor === 'string' ? cfg.hairColor : '#1e293b',
    },
  };
}

interface RemoteEntry {
  state: LobbyPlayerState;
  root: TransformNode;
  animator: HumanoidAnimator;
  yaw: number;
  targetPosition: LobbyPlayerState['position'];
  targetRotationY: number;
  targetAnimation: LobbyAnimationState;
  lastUpdateAt: number;
  /** Smoothed horizontal speed, so remote cadence matches remote movement. */
  speed: number;
  /** Accumulated dt while animation updates are throttled. */
  animAcc: number;
  frame: number;
  /** True until real GLB (or final procedural) has replaced the stand-in. */
  isPlaceholder: boolean;
  /** Invalidates in-flight GLB loads after remove/replace. */
  generation: number;
  /** Last applied draw visibility for off-screen remotes. */
  drawVisible: boolean;
}

export class RemotePlayerManager {
  private readonly remotes = new Map<string, RemoteEntry>();
  /** userId → in-flight generation (also used as "loading" flag). */
  private readonly loadingGen = new Map<string, number>();
  private generationSeq = 0;

  constructor(
    private readonly scene: Scene,
    private readonly selfUserId: string,
  ) {}

  upsert(player: LobbyPlayerState) {
    if (player.userId === this.selfUserId) return;

    const existing = this.remotes.get(player.userId);
    if (existing) {
      this.applyMove({
        userId: player.userId,
        position: player.position,
        rotationY: player.rotationY,
        animation: player.animation,
      });
      existing.state = player;
      return;
    }

    if (this.loadingGen.has(player.userId)) return;
    void this.spawnRemote(player);
  }

  private async spawnRemote(player: LobbyPlayerState) {
    const userId = player.userId;
    const generation = ++this.generationSeq;
    this.loadingGen.set(userId, generation);
    const tSpawn = performance.now();
    const rootName = `remote-${userId}`;

    try {
      if (this.remotes.has(userId)) return;

      // 1) Immediate cheap placeholder — lobby stays responsive while GLB loads.
      const phRoot = AvatarFactory.create(
        this.scene,
        placeholderAvatar(player),
        rootName,
        player.displayName,
        player.username,
        { collider: 'body' },
      );
      AvatarFactory.markLobbyAvatar(phRoot, this.scene);
      AvatarFactory.setPosition(phRoot, player.position);
      AvatarFactory.setRotationY(phRoot, player.rotationY);
      syncCharacterObstacle(this.scene, phRoot.name, player.position.x, player.position.z);

      if (!this.isSpawnCurrent(userId, generation)) {
        removeCharacterObstacle(this.scene, phRoot.name);
        phRoot.dispose();
        return;
      }

      const entry: RemoteEntry = {
        state: player,
        root: phRoot,
        animator: new HumanoidAnimator(phRoot, AvatarFactory.getAnimationGroups(phRoot)),
        yaw: player.rotationY,
        targetPosition: { ...player.position },
        targetRotationY: player.rotationY,
        targetAnimation: player.animation,
        lastUpdateAt: Date.now(),
        speed: 0,
        animAcc: 0,
        frame: 0,
        isPlaceholder: true,
        generation,
        drawVisible: true,
      };
      this.remotes.set(userId, entry);
      if (isLobbyPerfDiagEnabled()) {
        lobbyPerfMark('remote_placeholder', performance.now() - tSpawn, userId);
      }

      // Let a couple of frames paint the placeholder before heavy GLB work.
      await yieldToRenderLoop();
      if (!this.isSpawnCurrent(userId, generation)) return;

      // 2) Async real avatar (cache hit stays fast; miss no longer blocks first paint).
      const realName = `${rootName}-mesh`;
      let realRoot: TransformNode;
      try {
        realRoot = await AvatarFactory.createAsync(
          this.scene,
          player.avatar,
          realName,
          player.displayName,
          player.username,
          { collider: 'body' },
        );
      } catch (err) {
        console.warn('[lobby-sdk] remote GLB failed; keeping placeholder', userId, err);
        const cur = this.remotes.get(userId);
        if (cur && cur.generation === generation) cur.isPlaceholder = false;
        if (isLobbyPerfDiagEnabled()) {
          lobbyPerfMark('remote_spawn_total', performance.now() - tSpawn, `${userId}:placeholder-fallback`);
        }
        return;
      }

      if (!this.isSpawnCurrent(userId, generation)) {
        realRoot.dispose();
        return;
      }

      const cur = this.remotes.get(userId);
      if (!cur || cur.generation !== generation) {
        realRoot.dispose();
        return;
      }

      // 3) Swap placeholder → real (safe dispose).
      const pos = { x: cur.root.position.x, y: cur.root.position.y, z: cur.root.position.z };
      const yaw = cur.yaw;
      removeCharacterObstacle(this.scene, cur.root.name);
      const oldRoot = cur.root;
      cur.root = realRoot;
      cur.animator = new HumanoidAnimator(realRoot, AvatarFactory.getAnimationGroups(realRoot));
      cur.isPlaceholder = false;
      cur.drawVisible = true;
      AvatarFactory.setPosition(realRoot, pos);
      AvatarFactory.setRotationY(realRoot, yaw);
      syncCharacterObstacle(this.scene, realRoot.name, pos.x, pos.z);
      oldRoot.dispose();

      if (isLobbyPerfDiagEnabled()) {
        lobbyPerfMark('remote_spawn_total', performance.now() - tSpawn, userId);
      }
    } finally {
      if (this.loadingGen.get(userId) === generation) {
        this.loadingGen.delete(userId);
      }
    }
  }

  private isSpawnCurrent(userId: string, generation: number) {
    return this.loadingGen.get(userId) === generation;
  }

  applyMove(payload: {
    userId: string;
    position?: LobbyPlayerState['position'];
    rotationY?: number;
    animation?: LobbyAnimationState;
  }) {
    const entry = this.remotes.get(payload.userId);
    if (!entry) return;
    if (payload.position) entry.targetPosition = { ...payload.position };
    if (payload.rotationY !== undefined) entry.targetRotationY = payload.rotationY;
    if (payload.animation !== undefined) entry.targetAnimation = payload.animation;
    entry.lastUpdateAt = Date.now();
  }

  applyEmote(userId: string, emote: LobbyEmoteKind) {
    const entry = this.remotes.get(userId);
    if (!entry) return;
    entry.state.emote = emote;
  }

  remove(userId: string) {
    // Invalidate any in-flight GLB so it cannot attach after leave.
    this.loadingGen.delete(userId);
    const entry = this.remotes.get(userId);
    if (!entry) return;
    removeCharacterObstacle(this.scene, entry.root.name);
    entry.root.dispose();
    this.remotes.delete(userId);
  }

  getIdentity(userId: string) {
    const entry = this.remotes.get(userId);
    if (!entry) return null;
    return {
      displayName: entry.state.displayName,
      username: entry.state.username,
    };
  }

  isRemoteReady(userId: string) {
    const entry = this.remotes.get(userId);
    return !!entry && !entry.isPlaceholder;
  }

  private setDrawVisible(entry: RemoteEntry, visible: boolean) {
    if (entry.drawVisible === visible) return;
    entry.drawVisible = visible;
    let meshes: AbstractMesh[] = [];
    try {
      meshes = entry.root.getChildMeshes?.(false) ?? [];
    } catch {
      return;
    }
    for (const mesh of meshes) {
      if (!mesh || mesh.metadata?.isNameTag) continue;
      mesh.isVisible = visible;
    }
  }

  update(dt: number) {
    const t0 = isLobbyPerfDiagEnabled() ? performance.now() : 0;
    const camera = this.scene.activeCamera;
    const camPos = camera?.globalPosition;

    for (const entry of this.remotes.values()) {
      const air = isAir(entry.targetAnimation);
      const xzFollow = 1 - Math.exp(-12 * dt);
      const yFollow = 1 - Math.exp(-(air ? 28 : 12) * dt);
      const pos = entry.root.position;
      const prevX = pos.x;
      const prevZ = pos.z;
      pos.x += (entry.targetPosition.x - pos.x) * xzFollow;
      pos.y += (entry.targetPosition.y - pos.y) * yFollow;
      pos.z += (entry.targetPosition.z - pos.z) * xzFollow;
      let d = entry.targetRotationY - entry.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      entry.yaw += d * xzFollow;
      AvatarFactory.setRotationY(entry.root, entry.yaw);
      const travelled = dt > 0 ? Math.hypot(pos.x - prevX, pos.z - prevZ) / dt : 0;
      entry.speed += (travelled - entry.speed) * (1 - Math.exp(-9 * dt));

      // Skip collider rewrite when barely moved (cheaper with many remotes).
      if (Math.hypot(pos.x - prevX, pos.z - prevZ) > 0.002) {
        syncCharacterObstacle(this.scene, entry.root.name, pos.x, pos.z);
      }

      entry.animAcc += dt;
      entry.frame = (entry.frame + 1) | 0;

      let stride = 1;
      let offScreen = false;
      if (camPos) {
        const dx = pos.x - camPos.x;
        const dy = pos.y - camPos.y;
        const dz = pos.z - camPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        stride = remoteAvatarAnimStride(distSq);
        offScreen = !!(camera && isRoughlyBehindCamera(camera, pos.x, pos.z) && distSq > 100);

        // Hide off-screen remotes from the draw list (does not touch alwaysSelectAsActiveMesh).
        // Near-camera remotes stay fully visible — never "invisible" when they should be seen.
        if (offScreen) {
          this.setDrawVisible(entry, false);
          entry.animAcc = 0;
          continue;
        }
        this.setDrawVisible(entry, true);

        // Far remotes: skip obstacle sync already handled; anim stride covers CPU.
        if (distSq > 48 * 48) {
          stride = Math.max(stride, 4);
        }
      }

      if (stride > 1 && entry.frame % stride !== 0) continue;

      const animDt = entry.animAcc;
      entry.animAcc = 0;
      entry.animator.update(animDt, entry.targetAnimation, !air, entry.speed);
    }
    if (isLobbyPerfDiagEnabled()) {
      lobbyPerfNoteRemoteUpdate(performance.now() - t0);
    }
  }

  getPosition(userId: string): LobbyPlayerState['position'] | null {
    const entry = this.remotes.get(userId);
    if (!entry) return null;
    return { ...entry.targetPosition };
  }

  list() {
    return [...this.remotes.values()].map((entry) => ({
      userId: entry.state.userId,
      displayName: entry.state.displayName,
      avatar: entry.state.avatar,
      position: { ...entry.targetPosition },
      rotationY: entry.targetRotationY,
      animation: entry.targetAnimation,
      ready: !entry.isPlaceholder,
    }));
  }

  dispose() {
    this.loadingGen.clear();
    for (const entry of this.remotes.values()) {
      removeCharacterObstacle(this.scene, entry.root.name);
      entry.root.dispose();
    }
    this.remotes.clear();
  }
}
