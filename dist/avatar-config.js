/** Resolve absolute/relative glbUrl from SdkLobbyAvatar (phase A config). */
export function resolveGlbUrl(avatar) {
    if (avatar.presetKind !== 'glb')
        return null;
    const config = (avatar.customConfig ?? {});
    const url = config.glbUrl;
    return typeof url === 'string' && url.trim() ? url.trim() : null;
}
//# sourceMappingURL=avatar-config.js.map