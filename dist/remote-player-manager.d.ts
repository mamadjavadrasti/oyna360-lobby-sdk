import type { Scene } from '@babylonjs/core';
import type { LobbyAnimationState, LobbyEmoteKind, LobbyPlayerState } from './protocol';
import { type RemoteAvatarLifecycle } from './avatar-instance';
export declare class RemotePlayerManager {
    private readonly scene;
    private readonly selfUserId;
    private readonly remotes;
    /** userId → in-flight generation (also used as "loading" flag). */
    private readonly loadingGen;
    private generationSeq;
    constructor(scene: Scene, selfUserId: string);
    upsert(player: LobbyPlayerState): void;
    private spawnRemote;
    private isSpawnCurrent;
    applyMove(payload: {
        userId: string;
        position?: LobbyPlayerState['position'];
        rotationY?: number;
        animation?: LobbyAnimationState;
    }): void;
    applyEmote(userId: string, emote: LobbyEmoteKind): void;
    remove(userId: string): void;
    getIdentity(userId: string): {
        displayName: string;
        username: string;
    } | null;
    isRemoteReady(userId: string): boolean;
    getLifecycle(userId: string): RemoteAvatarLifecycle;
    private setDrawVisible;
    update(dt: number): void;
    getPosition(userId: string): LobbyPlayerState['position'] | null;
    list(): {
        userId: string;
        displayName: string;
        avatar: import("./protocol").SdkLobbyAvatar;
        position: {
            x: number;
            y: number;
            z: number;
        };
        rotationY: number;
        animation: LobbyAnimationState;
        ready: boolean;
        lifecycle: RemoteAvatarLifecycle;
    }[];
    dispose(): void;
}
//# sourceMappingURL=remote-player-manager.d.ts.map