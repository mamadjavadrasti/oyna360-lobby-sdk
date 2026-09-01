import type { Scene } from '@babylonjs/core';
import type { LobbyAnimationState, LobbyEmoteKind, LobbyPlayerState } from './protocol';
import { AvatarFactory } from './avatar-factory';
import { HumanoidAnimator } from './humanoid-animator';
import { removeCharacterObstacle, syncCharacterObstacle } from './lobby-colliders';

function isAir(animation: LobbyAnimationState) {
  return animation === 'jump' || animation === 'fall';
}

interface RemoteEntry {
  state: LobbyPlayerState;
  root: ReturnType<typeof AvatarFactory.create>;
  animator: HumanoidAnimator;
  yaw: number;
  targetPosition: LobbyPlayerState['position'];
  targetRotationY: number;
  targetAnimation: LobbyAnimationState;
  lastUpdateAt: number;
}

export class RemotePlayerManager {
  private readonly remotes = new Map<string, RemoteEntry>();

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

    const root = AvatarFactory.create(
      this.scene,
      player.avatar,
      `remote-${player.userId}`,
      player.displayName,
      player.username,
      { collider: 'body' },
    );
    const entry: RemoteEntry = {
      state: player,
      root,
      animator: new HumanoidAnimator(root),
      yaw: player.rotationY,
      targetPosition: { ...player.position },
      targetRotationY: player.rotationY,
      targetAnimation: player.animation,
      lastUpdateAt: Date.now(),
    };
    this.remotes.set(player.userId, entry);
    AvatarFactory.setPosition(root, player.position);
    AvatarFactory.setRotationY(root, player.rotationY);
    syncCharacterObstacle(this.scene, root.name, player.position.x, player.position.z);
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
  }

  applyEmote(userId: string, emote: LobbyEmoteKind) {
    const entry = this.remotes.get(userId);
    if (!entry) return;
    entry.state.emote = emote;
  }

  remove(userId: string) {
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

  update(dt: number) {
    for (const entry of this.remotes.values()) {
      const air = isAir(entry.targetAnimation);
      const xzFollow = 1 - Math.exp(-12 * dt);
      const yFollow = 1 - Math.exp(-(air ? 28 : 12) * dt);
      const pos = entry.root.position;
      pos.x += (entry.targetPosition.x - pos.x) * xzFollow;
      pos.y += (entry.targetPosition.y - pos.y) * yFollow;
      pos.z += (entry.targetPosition.z - pos.z) * xzFollow;
      let d = entry.targetRotationY - entry.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      entry.yaw += d * xzFollow;
      AvatarFactory.setRotationY(entry.root, entry.yaw);
      entry.animator.update(dt, entry.targetAnimation, !air);
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
