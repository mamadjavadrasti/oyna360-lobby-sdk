import { AvatarFactory } from './avatar-factory';
import { HumanoidAnimator } from './humanoid-animator';
import { removeCharacterObstacle, syncCharacterObstacle } from './lobby-colliders';
function isAir(animation) {
    return animation === 'jump' || animation === 'fall';
}
export class RemotePlayerManager {
    scene;
    selfUserId;
    remotes = new Map();
    constructor(scene, selfUserId) {
        this.scene = scene;
        this.selfUserId = selfUserId;
    }
    upsert(player) {
        if (player.userId === this.selfUserId)
            return;
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
        const root = AvatarFactory.create(this.scene, player.avatar, `remote-${player.userId}`, player.displayName, { collider: 'body' });
        const entry = {
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
    applyMove(payload) {
        const entry = this.remotes.get(payload.userId);
        if (!entry)
            return;
        entry.targetPosition = { ...payload.position };
        entry.targetRotationY = payload.rotationY;
        entry.targetAnimation = payload.animation;
        entry.lastUpdateAt = Date.now();
    }
    applyEmote(userId, emote) {
        const entry = this.remotes.get(userId);
        if (!entry)
            return;
        entry.state.emote = emote;
    }
    remove(userId) {
        const entry = this.remotes.get(userId);
        if (!entry)
            return;
        removeCharacterObstacle(this.scene, entry.root.name);
        entry.root.dispose();
        this.remotes.delete(userId);
    }
    update(dt) {
        for (const entry of this.remotes.values()) {
            const air = isAir(entry.targetAnimation);
            const xzFollow = 1 - Math.exp(-12 * dt);
            const yFollow = 1 - Math.exp(-(air ? 28 : 12) * dt);
            const pos = entry.root.position;
            pos.x += (entry.targetPosition.x - pos.x) * xzFollow;
            pos.y += (entry.targetPosition.y - pos.y) * yFollow;
            pos.z += (entry.targetPosition.z - pos.z) * xzFollow;
            let d = entry.targetRotationY - entry.yaw;
            while (d > Math.PI)
                d -= Math.PI * 2;
            while (d < -Math.PI)
                d += Math.PI * 2;
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
//# sourceMappingURL=remote-player-manager.js.map