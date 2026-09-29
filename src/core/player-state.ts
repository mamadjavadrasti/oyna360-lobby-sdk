import type { LobbyPlayerState } from './protocol.js';

/** Phase 0 player snapshot used by LobbyClient (wire LobbyPlayerState). */
export type PlayerState = LobbyPlayerState;

export function playerKey(player: PlayerState): string {
  return player.userId;
}
