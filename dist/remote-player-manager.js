import { Vector3 } from '@babylonjs/core';
import { AvatarFactory } from './avatar-factory';
import { AvatarAssetManager } from './avatar-asset-manager';
import { HumanoidAnimator } from './humanoid-animator';
import { removeCharacterObstacle, syncCharacterObstacle } from './lobby-colliders';
import { remoteAvatarAnimStride } from './quality';
import { isLobbyPerfDiagEnabled, lobbyPerfMark, lobbyPerfNoteRemoteUpdate } from './lobby-perf-diag';
import { resolveGlbUrl } from './avatar-config';
import { yieldToRenderLoop } from './yield-to-render';
function isAir(animation) {
    return animation === 'jump' || animation === 'fall';
}
/** Cheap behind-camera test — skip anim work when the player is not on screen. */
function isRoughlyBehindCamera(camera, worldX, worldZ) {
    const cam = camera.globalPosition;
    const dx = worldX - cam.x;
    const dz = worldZ - cam.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < 16)
        return false;
    const inv = 1 / Math.sqrt(distSq);
    const forward = camera.getDirection(Vector3.Forward());
    const fx = forward.x;
    const fz = forward.z;
    const flen = Math.hypot(fx, fz);
    if (flen < 1e-5)
        return false;
    const dot = (fx / flen) * (dx * inv) + (fz / flen) * (dz * inv);
    return dot < -0.12;
}
/** Lightweight procedural stand-in description for the high-level spawn API. */
function placeholderAvatar(player) {
    const cfg = (player.avatar.customConfig ?? {});
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
export class RemotePlayerManager {
    scene;
    selfUserId;
    remotes = new Map();
    /** userId → in-flight generation (also used as "loading" flag). */
    loadingGen = new Map();
    generationSeq = 0;
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
        if (this.loadingGen.has(player.userId))
            return;
        void this.spawnRemote(player);
    }
    async spawnRemote(player) {
        const userId = player.userId;
        const generation = ++this.generationSeq;
        this.loadingGen.set(userId, generation);
        const tSpawn = performance.now();
        const rootName = `remote-${userId}`;
        try {
            if (this.remotes.has(userId))
                return;
            // 1) Immediate cheap placeholder via high-level API (no GLB details here).
            const phAvatar = AvatarFactory.createPlaceholderInstance(this.scene, placeholderAvatar(player), rootName, player.displayName, player.username, { collider: 'body' });
            phAvatar.setPosition(player.position);
            phAvatar.setRotationY(player.rotationY);
            syncCharacterObstacle(this.scene, phAvatar.name, player.position.x, player.position.z);
            if (!this.isSpawnCurrent(userId, generation)) {
                removeCharacterObstacle(this.scene, phAvatar.name);
                phAvatar.dispose();
                return;
            }
            const entry = {
                state: player,
                avatar: phAvatar,
                animator: new HumanoidAnimator(phAvatar),
                lifecycle: 'PLACEHOLDER',
                yaw: player.rotationY,
                targetPosition: { ...player.position },
                targetRotationY: player.rotationY,
                targetAnimation: player.animation,
                lastUpdateAt: Date.now(),
                speed: 0,
                animAcc: 0,
                frame: 0,
                generation,
                drawVisible: true,
            };
            this.remotes.set(userId, entry);
            if (isLobbyPerfDiagEnabled()) {
                lobbyPerfMark('remote_placeholder', performance.now() - tSpawn, userId);
            }
            // Let a couple of frames paint the placeholder before heavy GLB work.
            {
                const tYield = performance.now();
                await yieldToRenderLoop();
                if (isLobbyPerfDiagEnabled()) {
                    lobbyPerfMark('remote_yield', performance.now() - tYield, userId);
                }
            }
            if (!this.isSpawnCurrent(userId, generation))
                return;
            // Warm this remote's base container while the placeholder is visible so a
            // different-base join does not stack cold LoadAssetContainer + instantiate.
            const remoteGlb = resolveGlbUrl(player.avatar);
            if (remoteGlb && !AvatarAssetManager.isContainerCached(this.scene, remoteGlb)) {
                const tWarm = performance.now();
                await AvatarAssetManager.warmGlbUrl(this.scene, remoteGlb);
                if (isLobbyPerfDiagEnabled()) {
                    lobbyPerfMark('remote_warm_glb', performance.now() - tWarm, userId);
                }
                await yieldToRenderLoop();
                if (!this.isSpawnCurrent(userId, generation))
                    return;
            }
            const curLoading = this.remotes.get(userId);
            if (curLoading && curLoading.generation === generation) {
                curLoading.lifecycle = 'LOADING';
            }
            // 2) Async real avatar through factory instance API.
            const realName = `${rootName}-mesh`;
            let realAvatar;
            try {
                realAvatar = await AvatarFactory.createInstanceAsync(this.scene, player.avatar, realName, player.displayName, player.username, { collider: 'body' });
            }
            catch (err) {
                console.warn('[lobby-sdk] remote avatar failed; keeping placeholder', userId, err);
                const cur = this.remotes.get(userId);
                if (cur && cur.generation === generation)
                    cur.lifecycle = 'READY';
                if (isLobbyPerfDiagEnabled()) {
                    lobbyPerfMark('remote_spawn_total', performance.now() - tSpawn, `${userId}:placeholder-fallback`);
                }
                return;
            }
            if (!this.isSpawnCurrent(userId, generation)) {
                realAvatar.dispose();
                return;
            }
            const cur = this.remotes.get(userId);
            if (!cur || cur.generation !== generation) {
                realAvatar.dispose();
                return;
            }
            // 3) Swap placeholder → real (safe dispose).
            const pos = {
                x: cur.avatar.position.x,
                y: cur.avatar.position.y,
                z: cur.avatar.position.z,
            };
            const yaw = cur.yaw;
            removeCharacterObstacle(this.scene, cur.avatar.name);
            const oldAvatar = cur.avatar;
            cur.avatar = realAvatar;
            cur.animator = new HumanoidAnimator(realAvatar);
            cur.lifecycle = 'READY';
            cur.drawVisible = true;
            realAvatar.setPosition(pos);
            realAvatar.setRotationY(yaw);
            syncCharacterObstacle(this.scene, realAvatar.name, pos.x, pos.z);
            oldAvatar.dispose();
            if (isLobbyPerfDiagEnabled()) {
                lobbyPerfMark('remote_spawn_total', performance.now() - tSpawn, userId);
            }
        }
        finally {
            if (this.loadingGen.get(userId) === generation) {
                this.loadingGen.delete(userId);
            }
        }
    }
    isSpawnCurrent(userId, generation) {
        return this.loadingGen.get(userId) === generation;
    }
    applyMove(payload) {
        const entry = this.remotes.get(payload.userId);
        if (!entry)
            return;
        if (payload.position)
            entry.targetPosition = { ...payload.position };
        if (payload.rotationY !== undefined)
            entry.targetRotationY = payload.rotationY;
        if (payload.animation !== undefined)
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
        // Invalidate any in-flight load so it cannot attach after leave.
        this.loadingGen.delete(userId);
        const entry = this.remotes.get(userId);
        if (!entry)
            return;
        removeCharacterObstacle(this.scene, entry.avatar.name);
        entry.lifecycle = 'DISPOSED';
        entry.avatar.dispose();
        this.remotes.delete(userId);
    }
    getIdentity(userId) {
        const entry = this.remotes.get(userId);
        if (!entry)
            return null;
        return {
            displayName: entry.state.displayName,
            username: entry.state.username,
        };
    }
    isRemoteReady(userId) {
        const entry = this.remotes.get(userId);
        return !!entry && entry.lifecycle === 'READY';
    }
    getLifecycle(userId) {
        return this.remotes.get(userId)?.lifecycle ?? 'NONE';
    }
    setDrawVisible(entry, visible) {
        if (entry.drawVisible === visible)
            return;
        entry.drawVisible = visible;
        for (const mesh of entry.avatar.getChildMeshes(false)) {
            if (!mesh || mesh.metadata?.isNameTag)
                continue;
            mesh.isVisible = visible;
        }
    }
    update(dt) {
        const t0 = isLobbyPerfDiagEnabled() ? performance.now() : 0;
        const camera = this.scene.activeCamera;
        const camPos = camera?.globalPosition;
        for (const entry of this.remotes.values()) {
            if (entry.lifecycle === 'DISPOSED')
                continue;
            const air = isAir(entry.targetAnimation);
            const xzFollow = 1 - Math.exp(-12 * dt);
            const yFollow = 1 - Math.exp(-(air ? 28 : 12) * dt);
            const pos = entry.avatar.position;
            const prevX = pos.x;
            const prevZ = pos.z;
            pos.x += (entry.targetPosition.x - pos.x) * xzFollow;
            pos.y += (entry.targetPosition.y - pos.y) * yFollow;
            pos.z += (entry.targetPosition.z - pos.z) * xzFollow;
            let d = entry.targetRotationY - entry.yaw;
            while (d > Math.PI)
                d -= Math.PI * 2;
            while (d < -Math.PI)
                d += Math.PI * 2;
            entry.yaw += d * xzFollow;
            entry.avatar.setRotationY(entry.yaw);
            const travelled = dt > 0 ? Math.hypot(pos.x - prevX, pos.z - prevZ) / dt : 0;
            entry.speed += (travelled - entry.speed) * (1 - Math.exp(-9 * dt));
            // Skip collider rewrite when barely moved (cheaper with many remotes).
            if (Math.hypot(pos.x - prevX, pos.z - prevZ) > 0.002) {
                syncCharacterObstacle(this.scene, entry.avatar.name, pos.x, pos.z);
            }
            entry.animAcc += dt;
            entry.frame = (entry.frame + 1) | 0;
            let stride = 1;
            if (camPos) {
                const dx = pos.x - camPos.x;
                const dy = pos.y - camPos.y;
                const dz = pos.z - camPos.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                stride = remoteAvatarAnimStride(distSq);
                const offScreen = !!(camera && isRoughlyBehindCamera(camera, pos.x, pos.z) && distSq > 100);
                // Hide off-screen remotes from the draw list (does not touch alwaysSelectAsActiveMesh).
                if (offScreen) {
                    this.setDrawVisible(entry, false);
                    entry.animAcc = 0;
                    continue;
                }
                this.setDrawVisible(entry, true);
                if (distSq > 48 * 48) {
                    stride = Math.max(stride, 4);
                }
            }
            if (stride > 1 && entry.frame % stride !== 0)
                continue;
            const animDt = entry.animAcc;
            entry.animAcc = 0;
            entry.animator.update(animDt, entry.targetAnimation, !air, entry.speed);
        }
        if (isLobbyPerfDiagEnabled()) {
            lobbyPerfNoteRemoteUpdate(performance.now() - t0);
        }
    }
    getPosition(userId) {
        const entry = this.remotes.get(userId);
        if (!entry)
            return null;
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
            ready: entry.lifecycle === 'READY',
            lifecycle: entry.lifecycle,
        }));
    }
    dispose() {
        this.loadingGen.clear();
        for (const entry of this.remotes.values()) {
            removeCharacterObstacle(this.scene, entry.avatar.name);
            entry.lifecycle = 'DISPOSED';
            entry.avatar.dispose();
        }
        this.remotes.clear();
    }
}
//# sourceMappingURL=remote-player-manager.js.map