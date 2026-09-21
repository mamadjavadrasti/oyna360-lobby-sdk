import type { LobbyPlugin } from './types';

export function defineLobbyPlugin(plugin: LobbyPlugin): LobbyPlugin {
  return plugin;
}

export const ShopZonePlugin = defineLobbyPlugin({
  name: 'shop-zone',
  setup(lobby) {
    lobby.addZone({
      id: 'shop',
      bounds: { min: { x: -5, y: 0, z: -5 }, max: { x: 5, y: 3, z: 5 } },
      onEnter: () => lobby.emitOverlay('shop', { open: true }),
      onExit: () => lobby.emitOverlay('shop', { open: false }),
    });
  },
});

export const LeaderboardZonePlugin = defineLobbyPlugin({
  name: 'leaderboard-zone',
  setup(lobby) {
    lobby.addZone({
      id: 'leaderboard',
      bounds: { min: { x: 8, y: 0, z: -5 }, max: { x: 14, y: 3, z: 5 } },
      onEnter: () => lobby.emitOverlay('leaderboard', { open: true }),
      onExit: () => lobby.emitOverlay('leaderboard', { open: false }),
    });
  },
});
