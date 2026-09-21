export const LOBBY_SDK_BUILD = 'avatar-join-v13';
export { PlatformLobby } from './platform-lobby';
export { PlatformBridge } from './platform-bridge';
export { AvatarFactory, applyAvatarTint, applyAvatarBaseAlbedo, readBaseAlbedoUrlFromConfig } from './avatar-factory';
export { AvatarAssetManager, assetCacheKey } from './avatar-asset-manager';
export type { GlbInstance, AvatarBaseDef } from './avatar-asset-manager';
export { AvatarInstance } from './avatar-instance';
export type { RemoteAvatarLifecycle } from './avatar-instance';
export { AvatarRigBuilder } from './avatar-rig-builder';
export type { AvatarRig } from './avatar-rig-builder';
export { resolveGlbUrl } from './avatar-config';
export { attachAvatarAccessories, attachAccessoriesFromAvatarConfig } from './avatar-accessories';
export type { EquippedAccessory, AccessoryPrimitive } from './avatar-accessories';
export { HumanoidAnimator } from './humanoid-animator';
export {
  HumanoidPose,
  HUMANOID_JOINTS,
  HUMANOID_JOINT_INDEX,
  WALK_GAIT,
  RUN_GAIT,
  approach,
  cloneGait,
  footContacts,
  gaitFrequency,
  lerpGait,
  writeAirPose,
  writeGaitPose,
  writeIdlePose,
  writeSlidePose,
} from './humanoid-locomotion';
export type { GaitParams, HumanoidJoint } from './humanoid-locomotion';
export { buildHumanoidBoneRig, applyHumanoidPose } from './humanoid-rig';
export type { HumanoidBoneRig, HumanoidJointControl } from './humanoid-rig';
export { pickAvatarClip, dedupeClipsByName, AVATAR_CLIP_ALIASES } from './avatar-clips';
export { ThirdPersonCamera } from './third-person-camera';
export { applyLobbyCollisions, syncCharacterObstacle, removeCharacterObstacle } from './lobby-colliders';
export { NetworkClient } from './network-client';
export { RemotePlayerManager } from './remote-player-manager';
export { ZoneManager, PortalManager } from './zones';
export {
  defineLobbyPlugin,
  ShopZonePlugin,
  LeaderboardZonePlugin,
} from './plugins';

export type {
  PlatformLobbyConfig,
  PlatformLobbyCreateOptions,
  PlatformLobbyDevOptions,
  LobbyZoneOptions,
  LobbyPortalOptions,
  LobbyPlugin,
  LobbyEventMap,
  LobbyEventName,
  Vector3,
} from './types';

export { attachLobbyDebug, buildLobbyDebugReport, setLobbyCameraPreset } from './lobby-debug';
export type { LobbyDebugReport, LobbyDebugCheck, LobbyDebugHandle, LobbyCameraPreset } from './lobby-debug';
export {
  attachLobbyPerfDiag,
  captureLobbyPerfSnapshot,
  sampleLobbyPerf,
  setLobbyPerfDiagEnabled,
  resetLobbyPerfDiag,
  isLobbyPerfDiagEnabled,
  diagSetAlwaysSelectAsActiveMesh,
  diagSetAvatarDoubleSide,
  diagSetDisableUniformBuffers,
  getLobbyPerfPhaseSummary,
  captureLobbyPerfMemory,
  collectLobbyAvatarCosts,
  extractSpawnTimelineFromMarks,
  summarizeAvatarRenderCosts,
  sampleAvatarRender,
  captureWebGlInfo,
} from './lobby-perf-diag';
export type {
  LobbyPerfSnapshot,
  LobbyPerfSampleSeries,
  LobbyPerfDiagHandle,
  LobbyPerfPhase,
  LobbyPerfPhaseStat,
  LobbyPerfPhaseDist,
  LobbyPerfMemoryInfo,
  LobbyPerfAvatarCost,
  AvatarRenderCostSummary,
  AvatarRenderSample,
} from './lobby-perf-diag';
export {
  attachRealDeviceAvatarDiag,
  captureRealDeviceInfo,
  runRealDeviceAvatarSuite,
} from './lobby-real-device-diag';
export type {
  RealDeviceLobbyBridge,
  RealDeviceSuiteOptions,
  RealDeviceAvatarReport,
  RealDeviceInfo,
} from './lobby-real-device-diag';
export {
  attachPlazaDiag,
  runPlazaDiagSuite,
  inventoryPlazaSubsystems,
  classifyPlazaMesh,
  PLAZA_MESH_SUBSYSTEMS,
} from './lobby-plaza-diag';
export type {
  PlazaSubsystemId,
  PlazaSubsystemInventory,
  PlazaDiagReport,
  PlazaDiagSuiteOptions,
  PlazaDiagSample,
} from './lobby-plaza-diag';
export { attachNameTag } from './name-tag';
export { applyStarterLayout, createPortalVisual } from './starter-layout';
export type { StarterLayoutConfig } from './starter-layout';
export { applyPlazaLayout, DEFAULT_PLAZA_ROOMS } from './plaza-layout';
export type { PlazaLayoutConfig, PlazaRoomDef } from './plaza-layout';
export { attachPlayground } from './playground/playground-system';
export { LobbyMusic } from './lobby-music';
export { attachLobbyChatUi } from './lobby-chat-ui';
export { attachLobbyPresenceUi } from './lobby-presence-ui';
export { attachLobbyVoiceUi } from './lobby-voice-ui';
export { attachLobbyConnectionUi } from './lobby-connection-ui';
export { attachLobbyOrientationUi } from './lobby-orientation-ui';
export { resolveLobbyUiMessages } from './lobby-ui-i18n';
export type { LobbyUiLocale, LobbyUiMessages } from './lobby-ui-i18n';
export { LobbyVoiceChat } from './voice-chat';
export type { VoiceChatState, VoiceSignaling } from './voice-chat';
export { formatPlayerLabel, formatPlayerLabelParts, formatPlayerHandle, formatAvatarTagLabel } from './player-label';
export {
  DEFAULT_LOBBY_SPAWN,
  lobbySpawnPose,
  provisionalSpawnSlot,
  resolveSpawnPose,
  spawnLayoutFromConfig,
} from './spawn-utils';
export type { LobbySpawnLayout, LobbySpawnPose } from './spawn-utils';
export { ensureLobbyPersianFont, lobbyCanvasFont, LOBBY_UI_FONT } from './lobby-font';
export { SLIDE_ANCHOR, TRAMPOLINE_ANCHOR } from './playground/playground-layout';

export {
  LOBBY_QUALITY,
  detectLobbyQuality,
  isTouchDevice,
  lobbyQualitySettings,
  resolveLobbyQuality,
  shouldDisableLobbyBloom,
  shouldTrimAvatarDetailMaps,
  remoteAvatarAnimStride,
  LOBBY_AVATAR_ANIM_FULL_DIST,
  LOBBY_AVATAR_ANIM_HALF_DIST,
  LOBBY_AVATAR_ANIM_QUARTER_DIST,
} from './quality';
export type { LobbyQualityLevel, LobbyQualitySettings } from './quality';

export {
  LOBBY_PROTOCOL_VERSION,
  GLOBAL_AVATAR_ROOM_ID,
  gameRoomId,
  isRoomForGame,
  parseGameSlugFromRoom,
  LOBBY_CHAT_MAX_LEN,
  LOBBY_DATA_MAX_LEN,
  LOBBY_DATA_CHANNEL_MAX_LEN,
  sanitizeLobbyChat,
  sanitizeLobbyDataChannel,
  sanitizeLobbyDataPayload,
} from './protocol';
export type { LobbyVoiceMode, LobbyVoicePeerState, LobbyFeatureFlags } from './protocol';
