/** Types the lobby SDK needs from the platform handshake. Games do not install @platform/types. */

export type AvatarPresetKind = 'procedural' | 'glb';

export interface SdkLobbyAvatar {
  presetId: string;
  presetKey: string;
  presetKind: AvatarPresetKind;
  customConfig: Record<string, unknown>;
}

export interface SdkUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SdkSession {
  id: string;
  token: string;
}

export interface SdkGameInfo {
  slug: string;
  name: string;
}

export interface SdkInitPayload {
  session: SdkSession;
  user: SdkUser;
  game: SdkGameInfo;
  avatar: SdkLobbyAvatar;
  lobby?: {
    wsUrl: string;
    roomId: string;
  };
}

export interface PlatformInitMessage {
  type: 'platform:init';
  version: string;
  session: SdkSession;
  user: SdkUser;
  game: SdkGameInfo;
  avatar: SdkLobbyAvatar;
  lobby?: {
    wsUrl: string;
    roomId: string;
  };
}
