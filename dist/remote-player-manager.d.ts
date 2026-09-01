import type { Scene } from '@babylonjs/core';
import type { LobbyAnimationState, LobbyEmoteKind, LobbyPlayerState } from './protocol';
export declare class RemotePlayerManager {
    private readonly scene;
    private readonly selfUserId;
    private readonly remotes;
    constructor(scene: Scene, selfUserId: string);
    upsert(player: LobbyPlayerState): void;
    applyMove(payload: {
        userId: string;
        position: LobbyPlayerState['position'];
        rotationY: number;
        animation: LobbyAnimationState;
    }): void;
    applyEmote(userId: string, emote: LobbyEmoteKind): void;
    remove(userId: string): void;
    getIdentity(userId: string): {
        displayName: string;
        username: string;
    } | null;
    update(dt: number): void;
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
    }[];
    dispose(): void;
}
//# sourceMappingURL=remote-player-manager.d.ts.map