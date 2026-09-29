import type { PlayerState } from './player-state.js';
export interface RoomState {
    roomId: string;
    self: PlayerState | null;
    players: Map<string, PlayerState>;
}
export declare function createRoomState(roomId: string): RoomState;
export declare function upsertPlayer(room: RoomState, player: PlayerState): void;
export declare function removePlayer(room: RoomState, userId: string): void;
//# sourceMappingURL=room-state.d.ts.map