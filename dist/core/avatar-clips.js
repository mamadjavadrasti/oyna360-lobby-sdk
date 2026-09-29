/** Alias lists used to map lobby locomotion → clip names in a GLB. */
export const AVATAR_CLIP_ALIASES = {
    idle: ['idle', 'Idle', 'stand', 'Standing', 'TPose', 'APose'],
    walk: ['walk', 'Walk', 'walking', 'Walking', 'locomotion'],
    run: ['run', 'Run', 'running', 'Running', 'sprint', 'Sprint'],
    jump: ['jump', 'Jump'],
    fall: ['fall', 'Fall', 'falling', 'Falling'],
};
function matchAlias(clips, aliases) {
    return clips.find((c) => aliases.some((a) => c.name.toLowerCase().includes(a.toLowerCase()))) ?? null;
}
/**
 * Pick the best animation clip for a locomotion state.
 *
 * Important: never fall back idle → walk (Meshy often ships only Walking;
 * playing it while standing looks like the avatar always walks).
 * Returns null when no suitable clip exists — caller should freeze bind pose.
 */
export function pickAvatarClip(clips, state) {
    if (!clips.length)
        return null;
    const direct = matchAlias(clips, AVATAR_CLIP_ALIASES[state]);
    if (direct)
        return direct;
    if (state === 'run') {
        return matchAlias(clips, AVATAR_CLIP_ALIASES.walk);
    }
    if (state === 'jump' || state === 'fall') {
        return matchAlias(clips, AVATAR_CLIP_ALIASES.idle);
    }
    // idle / walk with no matching clip → null (bind pose), never invent a clip
    return null;
}
/** Drop duplicate clip names (Meshy often emits the same anim twice). Keep first. */
export function dedupeClipsByName(clips) {
    const seen = new Set();
    const out = [];
    for (const clip of clips) {
        const key = clip.name.trim().toLowerCase() || `__anon_${out.length}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(clip);
    }
    return out;
}
//# sourceMappingURL=avatar-clips.js.map