import type { LobbyAnimationState, LobbyEmoteKind, LobbyPlayerState } from './protocol.js';
import type { AvatarPresetKind, SdkLobbyAvatar } from './platform-types.js';
import { LobbyEmitter } from './events.js';
import { resolveGlbUrl } from './avatar-config.js';

/** Renderer-agnostic 3-vector (not Babylon Vector3). */
export type AvatarVec3 = { x: number; y: number; z: number };

/**
 * Attachment on the avatar (weapon, prop, etc.).
 * Core state only — no mesh/bone objects.
 */
export type AvatarAttachment = {
  id: string;
  itemId?: string;
  kind?: string;
  assetUrl?: string;
  bone?: string;
  slot?: string;
  position?: AvatarVec3;
  rotation?: AvatarVec3;
  scale?: AvatarVec3;
  metadata?: Record<string, unknown>;
};

/** Equipped cosmetic accessory (hat, pack, …). */
export type AvatarAccessory = {
  id: string;
  itemId?: string;
  kind?: string;
  slot?: string;
  assetUrl?: string;
  metadata?: Record<string, unknown>;
};

/** Appearance / material knobs — strings and URLs only. */
export type AvatarSkin = {
  tint?: string | null;
  bodyColor?: string;
  accentColor?: string;
  pantsColor?: string;
  hairColor?: string;
  /** Clothing / base albedo texture URL (existing customConfig.baseAlbedoUrl). */
  baseAlbedoUrl?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Local avatar customization state (Core).
 * Independent of Babylon / protocol wire messages.
 */
export type AvatarState = {
  /** Catalog / preset base id (maps to SdkLobbyAvatar.presetKey when synced to SDK shape). */
  baseId: string;
  modelUrl?: string | null;
  skin?: AvatarSkin | null;
  accessories?: AvatarAccessory[];
  attachments?: AvatarAttachment[];
  animation?: LobbyAnimationState | string | null;
  emote?: LobbyEmoteKind | string | null;
  metadata?: Record<string, unknown>;
};

export type AvatarStateChangeEvent = {
  state: AvatarState;
  reason: string;
};

export type LobbyAvatarEvents = {
  change: AvatarStateChangeEvent;
};

export type SetBaseInput = {
  baseId: string;
  modelUrl?: string | null;
  /** When set, preserved for SdkLobbyAvatar round-trip. */
  presetKind?: AvatarPresetKind;
  presetId?: string;
};

type SdkBridgeMeta = {
  presetId: string;
  presetKey: string;
  presetKind: AvatarPresetKind;
};

function cloneVec(v: AvatarVec3 | undefined): AvatarVec3 | undefined {
  return v ? { x: v.x, y: v.y, z: v.z } : undefined;
}

function cloneSkin(skin: AvatarSkin | null | undefined): AvatarSkin | null | undefined {
  if (skin == null) return skin;
  return {
    ...skin,
    metadata: skin.metadata ? { ...skin.metadata } : undefined,
  };
}

function cloneAccessory(a: AvatarAccessory): AvatarAccessory {
  return {
    ...a,
    metadata: a.metadata ? { ...a.metadata } : undefined,
  };
}

function cloneAttachment(a: AvatarAttachment): AvatarAttachment {
  return {
    ...a,
    position: cloneVec(a.position),
    rotation: cloneVec(a.rotation),
    scale: cloneVec(a.scale),
    metadata: a.metadata ? { ...a.metadata } : undefined,
  };
}

/** Deep-ish clone suitable for getState() snapshots. */
export function cloneAvatarState(state: AvatarState): AvatarState {
  return {
    baseId: state.baseId,
    modelUrl: state.modelUrl,
    skin: cloneSkin(state.skin),
    accessories: state.accessories?.map(cloneAccessory),
    attachments: state.attachments?.map(cloneAttachment),
    animation: state.animation,
    emote: state.emote,
    metadata: state.metadata ? { ...state.metadata } : undefined,
  };
}

function readString(config: Record<string, unknown>, key: string): string | undefined {
  const v = config[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * Build AvatarState from platform / protocol SdkLobbyAvatar (local only; no socket).
 */
export function avatarStateFromSdk(avatar: SdkLobbyAvatar): AvatarState {
  const config = (avatar.customConfig ?? {}) as Record<string, unknown>;
  const modelUrl = resolveGlbUrl(avatar);

  const skin: AvatarSkin = {};
  const tint = readString(config, 'tint') ?? readString(config, 'color');
  if (tint) skin.tint = tint;
  const bodyColor = readString(config, 'bodyColor');
  const accentColor = readString(config, 'accentColor');
  const pantsColor = readString(config, 'pantsColor');
  const hairColor = readString(config, 'hairColor');
  const baseAlbedoUrl = readString(config, 'baseAlbedoUrl') ?? null;
  if (bodyColor) skin.bodyColor = bodyColor;
  if (accentColor) skin.accentColor = accentColor;
  if (pantsColor) skin.pantsColor = pantsColor;
  if (hairColor) skin.hairColor = hairColor;
  if (baseAlbedoUrl !== null && config.baseAlbedoUrl != null) skin.baseAlbedoUrl = baseAlbedoUrl;

  const accessories: AvatarAccessory[] = [];
  const rawAcc = config.accessories;
  if (Array.isArray(rawAcc)) {
    for (let i = 0; i < rawAcc.length; i++) {
      const entry = rawAcc[i];
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const itemId = typeof e.itemId === 'string' ? e.itemId : undefined;
      const slot = typeof e.slot === 'string' ? e.slot : undefined;
      const id =
        typeof e.id === 'string' && e.id
          ? e.id
          : `${slot ?? 'acc'}:${itemId ?? i}`;
      const acc: AvatarAccessory = { id };
      if (itemId) acc.itemId = itemId;
      if (slot) acc.slot = slot;
      if (typeof e.glbUrl === 'string' && e.glbUrl) acc.assetUrl = e.glbUrl;
      if (typeof e.primitive === 'string' && e.primitive) acc.kind = e.primitive;
      if (typeof e.attachBone === 'string' && e.attachBone) {
        acc.metadata = { ...(acc.metadata ?? {}), attachBone: e.attachBone };
      }
      accessories.push(acc);
    }
  }

  const attachments: AvatarAttachment[] = [];
  const rawAtt = config.attachments;
  if (Array.isArray(rawAtt)) {
    for (let i = 0; i < rawAtt.length; i++) {
      const entry = rawAtt[i];
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const id = typeof e.id === 'string' && e.id ? e.id : `att:${i}`;
      const att: AvatarAttachment = { id };
      if (typeof e.itemId === 'string') att.itemId = e.itemId;
      if (typeof e.kind === 'string') att.kind = e.kind;
      if (typeof e.assetUrl === 'string') att.assetUrl = e.assetUrl;
      else if (typeof e.glbUrl === 'string') att.assetUrl = e.glbUrl;
      if (typeof e.bone === 'string') att.bone = e.bone;
      else if (typeof e.attachBone === 'string') att.bone = e.attachBone;
      if (typeof e.slot === 'string') att.slot = e.slot;
      if (e.position && typeof e.position === 'object') {
        const p = e.position as Record<string, unknown>;
        if (typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number') {
          att.position = { x: p.x, y: p.y, z: p.z };
        }
      }
      if (e.rotation && typeof e.rotation === 'object') {
        const r = e.rotation as Record<string, unknown>;
        if (typeof r.x === 'number' && typeof r.y === 'number' && typeof r.z === 'number') {
          att.rotation = { x: r.x, y: r.y, z: r.z };
        }
      }
      if (e.scale && typeof e.scale === 'object') {
        const s = e.scale as Record<string, unknown>;
        if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.z === 'number') {
          att.scale = { x: s.x, y: s.y, z: s.z };
        }
      }
      if (e.metadata && typeof e.metadata === 'object') {
        att.metadata = { ...(e.metadata as Record<string, unknown>) };
      }
      attachments.push(att);
    }
  }

  const hasSkin = Object.keys(skin).length > 0;

  return {
    baseId: avatar.presetKey || avatar.presetId || 'default',
    modelUrl: modelUrl,
    skin: hasSkin ? skin : undefined,
    accessories: accessories.length ? accessories : undefined,
    attachments: attachments.length ? attachments : undefined,
    metadata: {
      sdk: {
        presetId: avatar.presetId,
        presetKey: avatar.presetKey,
        presetKind: avatar.presetKind,
      } satisfies SdkBridgeMeta,
    },
  };
}

/**
 * Convert AvatarState back to SdkLobbyAvatar for the existing Babylon pipeline.
 * Does not send network messages.
 */
export function avatarStateToSdk(state: AvatarState): SdkLobbyAvatar {
  const meta = state.metadata?.sdk as SdkBridgeMeta | undefined;
  const presetKey = meta?.presetKey || state.baseId;
  const presetId = meta?.presetId || presetKey;
  let presetKind: AvatarPresetKind =
    meta?.presetKind ?? (state.modelUrl ? 'glb' : 'procedural');
  if (state.modelUrl) presetKind = 'glb';

  const customConfig: Record<string, unknown> = {};
  if (state.modelUrl) customConfig.glbUrl = state.modelUrl;

  const skin = state.skin;
  if (skin) {
    if (skin.tint) customConfig.tint = skin.tint;
    if (skin.bodyColor) customConfig.bodyColor = skin.bodyColor;
    if (skin.accentColor) customConfig.accentColor = skin.accentColor;
    if (skin.pantsColor) customConfig.pantsColor = skin.pantsColor;
    if (skin.hairColor) customConfig.hairColor = skin.hairColor;
    if (skin.baseAlbedoUrl != null && skin.baseAlbedoUrl !== '') {
      customConfig.baseAlbedoUrl = skin.baseAlbedoUrl;
    }
  }

  if (state.accessories?.length) {
    customConfig.accessories = state.accessories.map((a) => {
      const row: Record<string, unknown> = {
        id: a.id,
        itemId: a.itemId ?? a.id,
        slot: a.slot ?? 'hat',
      };
      if (a.assetUrl) row.glbUrl = a.assetUrl;
      if (a.kind) row.primitive = a.kind;
      const bone = a.metadata?.attachBone;
      if (typeof bone === 'string') row.attachBone = bone;
      return row;
    });
  }

  if (state.attachments?.length) {
    customConfig.attachments = state.attachments.map((a) => {
      const row: Record<string, unknown> = { id: a.id };
      if (a.itemId) row.itemId = a.itemId;
      if (a.kind) row.kind = a.kind;
      if (a.assetUrl) row.assetUrl = a.assetUrl;
      if (a.bone) row.bone = a.bone;
      if (a.slot) row.slot = a.slot;
      if (a.position) row.position = { ...a.position };
      if (a.rotation) row.rotation = { ...a.rotation };
      if (a.scale) row.scale = { ...a.scale };
      if (a.metadata) row.metadata = { ...a.metadata };
      return row;
    });
  }

  return {
    presetId,
    presetKey,
    presetKind,
    customConfig,
  };
}

/**
 * Phase 0 compatibility: player.avatar as SdkLobbyAvatar view.
 * Prefer AvatarState + LobbyAvatarController for customization.
 */
export type AvatarStateView = SdkLobbyAvatar;

export function avatarFromPlayer(player: LobbyPlayerState): AvatarStateView {
  return player.avatar;
}

/**
 * Local avatar customization API (Core). State-only; no Babylon, no socket sync.
 */
export class LobbyAvatarController {
  readonly events = new LobbyEmitter<LobbyAvatarEvents>();
  private state: AvatarState;

  constructor(initial: AvatarState) {
    this.state = cloneAvatarState(initial);
  }

  static fromSdk(avatar: SdkLobbyAvatar): LobbyAvatarController {
    return new LobbyAvatarController(avatarStateFromSdk(avatar));
  }

  getState(): AvatarState {
    return cloneAvatarState(this.state);
  }

  /** Full replace (tests / advanced). */
  replaceState(next: AvatarState, reason = 'replace') {
    this.state = cloneAvatarState(next);
    this.emitChange(reason);
  }

  setBase(input: SetBaseInput) {
    this.state.baseId = input.baseId;
    if (input.modelUrl !== undefined) this.state.modelUrl = input.modelUrl;
    const sdk = (this.state.metadata?.sdk as SdkBridgeMeta | undefined) ?? {
      presetId: input.baseId,
      presetKey: input.baseId,
      presetKind: input.modelUrl ? 'glb' : 'procedural',
    };
    const nextSdk: SdkBridgeMeta = {
      presetId: input.presetId ?? sdk.presetId ?? input.baseId,
      presetKey: input.baseId,
      presetKind: input.presetKind ?? (input.modelUrl ? 'glb' : sdk.presetKind),
    };
    this.state.metadata = { ...(this.state.metadata ?? {}), sdk: nextSdk };
    this.emitChange('setBase');
  }

  setSkin(skin: AvatarSkin | null) {
    this.state.skin = skin == null ? null : cloneSkin(skin) ?? null;
    this.emitChange('setSkin');
  }

  /** Merge partial skin fields into current skin. */
  patchSkin(partial: Partial<AvatarSkin>) {
    const current = this.state.skin ?? {};
    this.state.skin = cloneSkin({ ...current, ...partial }) ?? null;
    this.emitChange('patchSkin');
  }

  addAccessory(accessory: AvatarAccessory) {
    if (!accessory.id) throw new Error('addAccessory requires id');
    const list = [...(this.state.accessories ?? [])];
    const idx = list.findIndex((a) => a.id === accessory.id);
    const next = cloneAccessory(accessory);
    if (idx >= 0) list[idx] = next;
    else list.push(next);
    this.state.accessories = list;
    this.emitChange('addAccessory');
  }

  removeAccessory(id: string) {
    if (!this.state.accessories?.length) return;
    this.state.accessories = this.state.accessories.filter((a) => a.id !== id);
    if (!this.state.accessories.length) this.state.accessories = undefined;
    this.emitChange('removeAccessory');
  }

  attach(attachment: AvatarAttachment) {
    if (!attachment.id) throw new Error('attach requires id');
    const list = [...(this.state.attachments ?? [])];
    const idx = list.findIndex((a) => a.id === attachment.id);
    const next = cloneAttachment(attachment);
    if (idx >= 0) list[idx] = next;
    else list.push(next);
    this.state.attachments = list;
    this.emitChange('attach');
  }

  removeAttachment(id: string) {
    if (!this.state.attachments?.length) return;
    this.state.attachments = this.state.attachments.filter((a) => a.id !== id);
    if (!this.state.attachments.length) this.state.attachments = undefined;
    this.emitChange('removeAttachment');
  }

  setAnimation(animation: LobbyAnimationState | string | null) {
    this.state.animation = animation;
    this.emitChange('setAnimation');
  }

  setEmote(emote: LobbyEmoteKind | string | null) {
    this.state.emote = emote;
    this.emitChange('setEmote');
  }

  /** Sdk shape for AvatarFactory / getAvatar() — local only. */
  toSdk(): SdkLobbyAvatar {
    return avatarStateToSdk(this.state);
  }

  on(event: 'change', handler: (payload: AvatarStateChangeEvent) => void) {
    return this.events.on(event, handler);
  }

  private emitChange(reason: string) {
    this.events.emit('change', { state: this.getState(), reason });
  }
}
