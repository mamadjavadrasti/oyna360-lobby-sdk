import { AvatarFactory } from './avatar-factory';
const INTERPOLATION_MS = 100;
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
        let entry = this.remotes.get(player.userId);
        if (!entry) {
            const root = AvatarFactory.create(this.scene, player.avatar, `remote-${player.userId}`, player.displayName);
            entry = {
                state: player,
                root,
                targetPosition: { ...player.position },
                targetRotationY: player.rotationY,
                targetAnimation: player.animation,
                lastUpdateAt: Date.now(),
            };
            this.remotes.set(player.userId, entry);
            AvatarFactory.setPosition(root, player.position);
            AvatarFactory.setRotationY(root, player.rotationY);
        }
        else {
            entry.state = player;
            entry.targetPosition = { ...player.position };
            entry.targetRotationY = player.rotationY;
            entry.targetAnimation = player.animation;
            entry.lastUpdateAt = Date.now();
        }
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
        // Visual emote: brief bounce
        entry.root.position.y += emote === 'wave' ? 0.2 : 0;
    }
    remove(userId) {
        const entry = this.remotes.get(userId);
        if (!entry)
            return;
        entry.root.dispose();
        this.remotes.delete(userId);
    }
    update(_dt) {
        const now = Date.now();
        for (const entry of this.remotes.values()) {
            const t = Math.min(1, (now - entry.lastUpdateAt + INTERPOLATION_MS) / INTERPOLATION_MS);
            const pos = entry.root.position;
            pos.x += (entry.targetPosition.x - pos.x) * t * 0.35;
            pos.y += (entry.targetPosition.y - pos.y) * t * 0.35;
            pos.z += (entry.targetPosition.z - pos.z) * t * 0.35;
            entry.root.rotation.y += (entry.targetRotationY - entry.root.rotation.y) * t * 0.35;
        }
    }
    dispose() {
        for (const entry of this.remotes.values()) {
            entry.root.dispose();
        }
        this.remotes.clear();
    }
}
//# sourceMappingURL=remote-player-manager.js.map