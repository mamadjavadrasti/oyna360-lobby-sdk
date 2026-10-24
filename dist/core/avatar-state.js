import { LobbyEmitter } from './events.js';
import { resolveGlbUrl, resolveAvatarBaseAlbedoUrl } from './avatar-config.js';
function cloneVec(v) {
    return v ? { x: v.x, y: v.y, z: v.z } : undefined;
}
function cloneSkin(skin) {
    if (skin == null)
        return skin;
    return {
        ...skin,
        metadata: skin.metadata ? { ...skin.metadata } : undefined,
    };
}
function cloneAccessory(a) {
    return {
        ...a,
        metadata: a.metadata ? { ...a.metadata } : undefined,
    };
}
function cloneAttachment(a) {
    return {
        ...a,
        position: cloneVec(a.position),
        rotation: cloneVec(a.rotation),
        scale: cloneVec(a.scale),
        metadata: a.metadata ? { ...a.metadata } : undefined,
    };
}
/** Deep-ish clone suitable for getState() snapshots. */
export function cloneAvatarState(state) {
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
function readString(config, key) {
    const v = config[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
/**
 * Build AvatarState from platform / protocol SdkLobbyAvatar (local only; no socket).
 */
export function avatarStateFromSdk(avatar) {
    const config = (avatar.customConfig ?? {});
    const modelUrl = resolveGlbUrl(avatar);
    const skin = {};
    const tint = readString(config, 'tintColor') ?? readString(config, 'tint') ?? readString(config, 'color');
    if (tint)
        skin.tint = tint;
    const bodyColor = readString(config, 'bodyColor');
    const accentColor = readString(config, 'accentColor');
    const pantsColor = readString(config, 'pantsColor');
    const hairColor = readString(config, 'hairColor');
    const baseAlbedoUrl = resolveAvatarBaseAlbedoUrl(config);
    if (bodyColor)
        skin.bodyColor = bodyColor;
    if (accentColor)
        skin.accentColor = accentColor;
    if (pantsColor)
        skin.pantsColor = pantsColor;
    if (hairColor)
        skin.hairColor = hairColor;
    if (baseAlbedoUrl !== null)
        skin.baseAlbedoUrl = baseAlbedoUrl;
    const accessories = [];
    const rawAcc = config.accessories;
    if (Array.isArray(rawAcc)) {
        for (let i = 0; i < rawAcc.length; i++) {
            const entry = rawAcc[i];
            if (!entry || typeof entry !== 'object')
                continue;
            const e = entry;
            const itemId = typeof e.itemId === 'string' ? e.itemId : undefined;
            const slot = typeof e.slot === 'string' ? e.slot : undefined;
            const id = typeof e.id === 'string' && e.id
                ? e.id
                : `${slot ?? 'acc'}:${itemId ?? i}`;
            const acc = { id };
            if (itemId)
                acc.itemId = itemId;
            if (slot)
                acc.slot = slot;
            if (typeof e.glbUrl === 'string' && e.glbUrl)
                acc.assetUrl = e.glbUrl;
            if (typeof e.primitive === 'string' && e.primitive)
                acc.kind = e.primitive;
            if (typeof e.attachBone === 'string' && e.attachBone) {
                acc.metadata = { ...(acc.metadata ?? {}), attachBone: e.attachBone };
            }
            accessories.push(acc);
        }
    }
    const attachments = [];
    const rawAtt = config.attachments;
    if (Array.isArray(rawAtt)) {
        for (let i = 0; i < rawAtt.length; i++) {
            const entry = rawAtt[i];
            if (!entry || typeof entry !== 'object')
                continue;
            const e = entry;
            const id = typeof e.id === 'string' && e.id ? e.id : `att:${i}`;
            const att = { id };
            if (typeof e.itemId === 'string')
                att.itemId = e.itemId;
            if (typeof e.kind === 'string')
                att.kind = e.kind;
            if (typeof e.assetUrl === 'string')
                att.assetUrl = e.assetUrl;
            else if (typeof e.glbUrl === 'string')
                att.assetUrl = e.glbUrl;
            if (typeof e.bone === 'string')
                att.bone = e.bone;
            else if (typeof e.attachBone === 'string')
                att.bone = e.attachBone;
            if (typeof e.slot === 'string')
                att.slot = e.slot;
            if (e.position && typeof e.position === 'object') {
                const p = e.position;
                if (typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number') {
                    att.position = { x: p.x, y: p.y, z: p.z };
                }
            }
            if (e.rotation && typeof e.rotation === 'object') {
                const r = e.rotation;
                if (typeof r.x === 'number' && typeof r.y === 'number' && typeof r.z === 'number') {
                    att.rotation = { x: r.x, y: r.y, z: r.z };
                }
            }
            if (e.scale && typeof e.scale === 'object') {
                const s = e.scale;
                if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.z === 'number') {
                    att.scale = { x: s.x, y: s.y, z: s.z };
                }
            }
            if (e.metadata && typeof e.metadata === 'object') {
                att.metadata = { ...e.metadata };
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
            },
        },
    };
}
/**
 * Convert AvatarState back to SdkLobbyAvatar for the existing Babylon pipeline.
 * Does not send network messages.
 */
export function avatarStateToSdk(state) {
    const meta = state.metadata?.sdk;
    const presetKey = meta?.presetKey || state.baseId;
    const presetId = meta?.presetId || presetKey;
    let presetKind = meta?.presetKind ?? (state.modelUrl ? 'glb' : 'procedural');
    if (state.modelUrl)
        presetKind = 'glb';
    const customConfig = {};
    if (state.modelUrl)
        customConfig.glbUrl = state.modelUrl;
    const skin = state.skin;
    if (skin) {
        if (skin.tint)
            customConfig.tint = skin.tint;
        if (skin.bodyColor)
            customConfig.bodyColor = skin.bodyColor;
        if (skin.accentColor)
            customConfig.accentColor = skin.accentColor;
        if (skin.pantsColor)
            customConfig.pantsColor = skin.pantsColor;
        if (skin.hairColor)
            customConfig.hairColor = skin.hairColor;
        if (skin.baseAlbedoUrl != null && skin.baseAlbedoUrl !== '') {
            customConfig.baseAlbedoUrl = skin.baseAlbedoUrl;
        }
    }
    if (state.accessories?.length) {
        customConfig.accessories = state.accessories.map((a) => {
            const row = {
                id: a.id,
                itemId: a.itemId ?? a.id,
                slot: a.slot ?? 'hat',
            };
            if (a.assetUrl)
                row.glbUrl = a.assetUrl;
            if (a.kind)
                row.primitive = a.kind;
            const bone = a.metadata?.attachBone;
            if (typeof bone === 'string')
                row.attachBone = bone;
            return row;
        });
    }
    if (state.attachments?.length) {
        customConfig.attachments = state.attachments.map((a) => {
            const row = { id: a.id };
            if (a.itemId)
                row.itemId = a.itemId;
            if (a.kind)
                row.kind = a.kind;
            if (a.assetUrl)
                row.assetUrl = a.assetUrl;
            if (a.bone)
                row.bone = a.bone;
            if (a.slot)
                row.slot = a.slot;
            if (a.position)
                row.position = { ...a.position };
            if (a.rotation)
                row.rotation = { ...a.rotation };
            if (a.scale)
                row.scale = { ...a.scale };
            if (a.metadata)
                row.metadata = { ...a.metadata };
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
export function avatarFromPlayer(player) {
    return player.avatar;
}
/**
 * Local avatar customization API (Core). State-only; no Babylon, no socket sync.
 */
export class LobbyAvatarController {
    events = new LobbyEmitter();
    state;
    constructor(initial) {
        this.state = cloneAvatarState(initial);
    }
    static fromSdk(avatar) {
        return new LobbyAvatarController(avatarStateFromSdk(avatar));
    }
    getState() {
        return cloneAvatarState(this.state);
    }
    /** Full replace (tests / advanced). */
    replaceState(next, reason = 'replace') {
        this.state = cloneAvatarState(next);
        this.emitChange(reason);
    }
    setBase(input) {
        this.state.baseId = input.baseId;
        if (input.modelUrl !== undefined)
            this.state.modelUrl = input.modelUrl;
        const sdk = this.state.metadata?.sdk ?? {
            presetId: input.baseId,
            presetKey: input.baseId,
            presetKind: input.modelUrl ? 'glb' : 'procedural',
        };
        const nextSdk = {
            presetId: input.presetId ?? sdk.presetId ?? input.baseId,
            presetKey: input.baseId,
            presetKind: input.presetKind ?? (input.modelUrl ? 'glb' : sdk.presetKind),
        };
        this.state.metadata = { ...(this.state.metadata ?? {}), sdk: nextSdk };
        this.emitChange('setBase');
    }
    setSkin(skin) {
        this.state.skin = skin == null ? null : cloneSkin(skin) ?? null;
        this.emitChange('setSkin');
    }
    /** Merge partial skin fields into current skin. */
    patchSkin(partial) {
        const current = this.state.skin ?? {};
        this.state.skin = cloneSkin({ ...current, ...partial }) ?? null;
        this.emitChange('patchSkin');
    }
    addAccessory(accessory) {
        if (!accessory.id)
            throw new Error('addAccessory requires id');
        const list = [...(this.state.accessories ?? [])];
        const idx = list.findIndex((a) => a.id === accessory.id);
        const next = cloneAccessory(accessory);
        if (idx >= 0)
            list[idx] = next;
        else
            list.push(next);
        this.state.accessories = list;
        this.emitChange('addAccessory');
    }
    removeAccessory(id) {
        if (!this.state.accessories?.length)
            return;
        this.state.accessories = this.state.accessories.filter((a) => a.id !== id);
        if (!this.state.accessories.length)
            this.state.accessories = undefined;
        this.emitChange('removeAccessory');
    }
    attach(attachment) {
        if (!attachment.id)
            throw new Error('attach requires id');
        const list = [...(this.state.attachments ?? [])];
        const idx = list.findIndex((a) => a.id === attachment.id);
        const next = cloneAttachment(attachment);
        if (idx >= 0)
            list[idx] = next;
        else
            list.push(next);
        this.state.attachments = list;
        this.emitChange('attach');
    }
    removeAttachment(id) {
        if (!this.state.attachments?.length)
            return;
        this.state.attachments = this.state.attachments.filter((a) => a.id !== id);
        if (!this.state.attachments.length)
            this.state.attachments = undefined;
        this.emitChange('removeAttachment');
    }
    setAnimation(animation) {
        this.state.animation = animation;
        this.emitChange('setAnimation');
    }
    setEmote(emote) {
        this.state.emote = emote;
        this.emitChange('setEmote');
    }
    /** Sdk shape for AvatarFactory / getAvatar() — local only. */
    toSdk() {
        return avatarStateToSdk(this.state);
    }
    on(event, handler) {
        return this.events.on(event, handler);
    }
    emitChange(reason) {
        this.events.emit('change', { state: this.getState(), reason });
    }
}
//# sourceMappingURL=avatar-state.js.map