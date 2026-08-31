import type { Scene } from '@babylonjs/core';
import type { LobbyAnimationState, LobbyEmoteKind, LobbyPlayerState } from './protocol';
import { AvatarFactory } from './avatar-factory';
import { HumanoidAnimator } from './humanoid-animator';
import { removeCharacterObstacle, syncCharacterObstacle } from './lobby-colliders';

interface RemoteEntry {
  state: LobbyPlayerState;
  root: ReturnType<typeof AvatarFactory.create>;
  animator: HumanoidAnimator;
  yaw: number;
  targetPosition: LobbyPlayerState['position'];
  targetRotationY: number;
  targetAnimation: LobbyAnimationState;
  lastUpdateAt: number;
  airHold: number;
}

export class RemotePlayerManager {
  private readonly remotes = new Map<string, RemoteEntry>();

  constructor(
    private readonly scene: Scene,
    private readonly selfUserId: string,
  ) {}

  upsert(player: LobbyPlayerState) {
    if (player.userId === this.selfUserId) return;

    let entry = this.remotes.get(player.userId);
    if (!entry) {
      const root = AvatarFactory.create(
        this.scene,
        player.avatar,
        `remote-${player.userId}`,
        player.displayName,
        { collider: 'body' },
      );
      entry = {
        state: player,
        root,
        animator: new HumanoidAnimator(root),
        yaw: player.rotationY,
        targetPosition: { ...player.position },
        targetRotationY: player.rotationY,
        targetAnimation: player.animation,
        lastUpdateAt: Date.now(),
        airHold: player.animation === 'jump' || player.animation === 'fall' ? 0.28 : 0,
      };
      this.remotes.set(player.userId, entry);
      AvatarFactory.setPosition(root, player.position);
      AvatarFactory.setRotationY(root, player.rotationY);
      syncCharacterObstacle(this.scene, root.name, player.position.x, player.position.z);
    } else {
      entry.state = player;
      entry.targetPosition = { ...player.position };
      entry.targetRotationY = player.rotationY;
      entry.targetAnimation = player.animation;
      entry.lastUpdateAt = Date.now();
      if (player.animation === 'jump' || player.animation === 'fall') {
        entry.airHold = Math.max(entry.airHold, 0.28);
      }
    }
  }

  applyMove(payload: {
    userId: string;
    position: LobbyPlayerState['position'];
    rotationY: number;
    animation: LobbyAnimationState;
  }) {
    const entry = this.remotes.get(payload.userId);
    if (!entry) return;
    entry.targetPosition = { ...payload.position };
    entry.targetRotationY = payload.rotationY;
    entry.targetAnimation = payload.animation;
    entry.lastUpdateAt = Date.now();
    if (payload.animation === 'jump' || payload.animation === 'fall') {
      entry.airHold = Math.max(entry.airHold, payload.animation === 'jump' ? 0.28 : 0.16);
    }
  }

  applyEmote(userId: string, emote: LobbyEmoteKind) {
    const entry = this.remotes.get(userId);
    if (!entry) return;
    entry.state.emote = emote;
    // Visual emote: brief bounce
    entry.root.position.y += emote === 'wave' ? 0.2 : 0;
  }

  remove(userId: string) {
    const entry = this.remotes.get(userId);
    if (!entry) return;
    removeCharacterObstacle(this.scene, entry.root.name);
    entry.root.dispose();
    this.remotes.delete(userId);
  }

  update(dt: number) {
    for (const entry of this.remotes.values()) {
      const airborne = entry.targetAnimation === 'jump' || entry.targetAnimation === 'fall';
      if (airborne) {
        entry.airHold = Math.max(entry.airHold, entry.targetAnimation === 'jump' ? 0.28 : 0.16);
      } else {
        entry.airHold = Math.max(0, entry.airHold - dt);
      }
      const pose = entry.airHold > 0
        ? (entry.targetAnimation === 'fall' ? 'fall' : 'jump')
        : entry.targetAnimation;
      const xzFollow = 1 - Math.exp(-(airborne || entry.airHold > 0 ? 16 : 12) * dt);
      const yFollow = 1 - Math.exp(-(airborne || entry.airHold > 0 ? 36 : 12) * dt);
      const pos = entry.root.position;
      pos.x += (entry.targetPosition.x - pos.x) * xzFollow;
      pos.y += (entry.targetPosition.y - pos.y) * yFollow;
      pos.z += (entry.targetPosition.z - pos.z) * xzFollow;
      let d = entry.targetRotationY - entry.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      entry.yaw += d * xzFollow;
      AvatarFactory.setRotationY(entry.root, entry.yaw);
      entry.animator.update(dt, pose, pose !== 'jump' && pose !== 'fall');
      syncCharacterObstacle(this.scene, entry.root.name, pos.x, pos.z);
    }
  }

  list() {
    return [...this.remotes.values()].map((entry) => ({
      userId: entry.state.userId,
      displayName: entry.state.displayName,
      avatar: entry.state.avatar,
      position: { ...entry.targetPosition },
      rotationY: entry.targetRotationY,
      animation: entry.targetAnimation,
    }));
  }

  dispose() {
    for (const entry of this.remotes.values()) {
      removeCharacterObstacle(this.scene, entry.root.name);
      entry.root.dispose();
    }
    this.remotes.clear();
  }
}
