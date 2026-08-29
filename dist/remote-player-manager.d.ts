import type { Scene } from '@babylonjs/core';
import type { LobbyAnimationState, LobbyEmoteKind, LobbyPlayerState } from '@platform/lobby-protocol';
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
    update(_dt: number): void;
    dispose(): void;
}
//# sourceMappingURL=remote-player-manager.d.ts.map