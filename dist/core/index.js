/** Core lobby SDK — no Babylon.js imports. */
export { LobbyClient } from './lobby-client.js';
export { NetworkClient } from './network-client.js';
export { PlatformBridge } from './platform-bridge.js';
export { LobbyEmitter } from './events.js';
export { createRoomState, upsertPlayer, removePlayer, } from './room-state.js';
export { playerKey } from './player-state.js';
export { LobbyAvatarController, avatarFromPlayer, avatarStateFromSdk, avatarStateToSdk, cloneAvatarState, } from './avatar-state.js';
export * from './protocol.js';
export { ZoneManager, PortalManager } from './zones.js';
export { resolveGlbUrl } from './avatar-config.js';
export { pickAvatarClip, dedupeClipsByName, AVATAR_CLIP_ALIASES } from './avatar-clips.js';
export * from './humanoid-locomotion.js';
export { resolveHumanoidJoints } from './humanoid-bone-names.js';
export { DEFAULT_LOBBY_SPAWN, lobbySpawnPose, spawnLayoutFromConfig, resolveSpawnPose, provisionalSpawnSlot, } from './spawn-utils.js';
export { defineLobbyPlugin, ShopZonePlugin, LeaderboardZonePlugin } from './plugins.js';
export { formatPlayerLabel, formatPlayerLabelParts, formatPlayerHandle, formatAvatarTagLabel, } from './player-label.js';
export { resolveLobbyQuality, lobbyQualitySettings, LOBBY_QUALITY, detectLobbyQuality, isTouchDevice, shouldDisableLobbyBloom, shouldTrimAvatarDetailMaps, remoteAvatarAnimStride, LOBBY_AVATAR_ANIM_FULL_DIST, LOBBY_AVATAR_ANIM_HALF_DIST, LOBBY_AVATAR_ANIM_QUARTER_DIST } from './quality.js';
export { LobbyVoiceChat } from './voice-chat.js';
export { LobbyMusic } from './lobby-music.js';
export { ensureLobbyPersianFont, lobbyCanvasFont, LOBBY_UI_FONT } from './lobby-font.js';
export { resolveLobbyUiMessages } from './lobby-ui-i18n.js';
export { yieldToRenderLoop } from './yield-to-render.js';
//# sourceMappingURL=index.js.map