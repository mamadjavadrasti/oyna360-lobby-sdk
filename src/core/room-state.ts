import type { PlayerState } from './player-state.js';

export interface RoomState {
  roomId: string;
  self: PlayerState | null;
  players: Map<string, PlayerState>;
}

export function createRoomState(roomId: string): RoomState {
  return { roomId, self: null, players: new Map() };
}

export function upsertPlayer(room: RoomState, player: PlayerState) {
  room.players.set(player.userId, player);
}

export function removePlayer(room: RoomState, userId: string) {
  room.players.delete(userId);
}
