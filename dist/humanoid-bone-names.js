/** Nodes that are containers or leaf markers, never animated joints. */
const IGNORED = /^(__root__|root|armature|scene|world|skeleton|humanoidrootnode|mesh_?\d*)(__a\d+)?$/;
const TIP = /(end|tip|nub|front|top)$/;
const ROLE_PATTERNS = [
    [/^hips?\d*$|pelvis/, 'hips'],
    [/spine|chest|torso|waist|abdomen|upperbody|ribcage/, 'spineish'],
    [/neck/, 'neck'],
    [/^head\d*$/, 'head'],
    [/shoulder|clavicle|collar/, 'shoulder'],
    [/forearm|lowerarm|elbow/, 'foreArm'],
    [/upperarm|^arm\d*$|humerus/, 'upperArm'],
    [/^hand\d*$|wrist/, 'hand'],
    [/upleg|thigh|upperleg|femur/, 'thigh'],
    [/lowerleg|^leg\d*$|calf|shin|knee|tibia/, 'shin'],
    [/^foot\d*$|ankle/, 'foot'],
];
export function normalizeBoneName(name) {
    return name.toLowerCase().replace(/^mixamorig[:_]?/, '');
}
export function detectBoneSide(raw) {
    if (raw.includes('left'))
        return 'L';
    if (raw.includes('right'))
        return 'R';
    if (/(^|[_.\- ])l([_.\- ]|\d|$)/.test(raw))
        return 'L';
    if (/(^|[_.\- ])r([_.\- ]|\d|$)/.test(raw))
        return 'R';
    return null;
}
/** Strips side markers without eating letters ("LeftLeg" → "leg", "L_Thigh" → "thigh"). */
export function boneCoreName(raw) {
    return raw
        .replace(/left|right/g, '')
        .replace(/(^|[_.\- ])[lr]([_.\- ])/g, '$1')
        .replace(/(^|[_.\- ])[lr]$/, '')
        .replace(/[^a-z0-9]/g, '');
}
export function detectBoneRole(core) {
    for (const [pattern, role] of ROLE_PATTERNS) {
        if (pattern.test(core))
            return role;
    }
    return null;
}
export function classifyBone(ref) {
    const raw = normalizeBoneName(ref.name);
    if (IGNORED.test(raw))
        return null;
    const core = boneCoreName(raw);
    if (!core || TIP.test(core) || core.startsWith('toe'))
        return null;
    const role = detectBoneRole(core);
    if (!role)
        return null;
    return { ref, role, side: detectBoneSide(raw) };
}
/** Shallowest wins: primary bones sit above twist/helper bones in the hierarchy. */
function pickPrimary(bones, role, side) {
    let best = null;
    for (const bone of bones) {
        if (bone.role !== role || bone.side !== side)
            continue;
        if (!best ||
            bone.ref.depth < best.ref.depth ||
            (bone.ref.depth === best.ref.depth && bone.ref.name.length < best.ref.name.length)) {
            best = bone;
        }
    }
    return best?.ref ?? null;
}
const SIDED = [
    ['shoulderL', 'shoulder', 'L'],
    ['shoulderR', 'shoulder', 'R'],
    ['upperArmL', 'upperArm', 'L'],
    ['upperArmR', 'upperArm', 'R'],
    ['foreArmL', 'foreArm', 'L'],
    ['foreArmR', 'foreArm', 'R'],
    ['handL', 'hand', 'L'],
    ['handR', 'hand', 'R'],
    ['thighL', 'thigh', 'L'],
    ['thighR', 'thigh', 'R'],
    ['shinL', 'shin', 'L'],
    ['shinR', 'shin', 'R'],
    ['footL', 'foot', 'L'],
    ['footR', 'foot', 'R'],
];
/** Joints without which no believable walk cycle is possible. */
export const REQUIRED_JOINTS = [
    'thighL',
    'thighR',
    'upperArmL',
    'upperArmR',
];
export function resolveHumanoidJoints(refs) {
    const bones = [];
    for (const ref of refs) {
        const classified = classifyBone(ref);
        if (classified)
            bones.push(classified);
    }
    const joints = {};
    const assign = (joint, role, side) => {
        const found = pickPrimary(bones, role, side);
        if (found)
            joints[joint] = found;
    };
    assign('hips', 'hips', null);
    assign('neck', 'neck', null);
    assign('head', 'head', null);
    for (const [joint, role, side] of SIDED)
        assign(joint, role, side);
    // Depth, not the number in the name, decides which vertebra is the chest:
    // Meshy exports `Hips → Spine02 → Spine01 → Spine`, Mixamo does the reverse.
    const spineChain = bones
        .filter((b) => b.role === 'spineish')
        .sort((a, b) => a.ref.depth - b.ref.depth || a.ref.name.length - b.ref.name.length);
    if (spineChain.length) {
        joints.spine = spineChain[0].ref;
        if (spineChain.length > 1)
            joints.chest = spineChain[spineChain.length - 1].ref;
    }
    const missing = REQUIRED_JOINTS.filter((joint) => !joints[joint]);
    return { joints, missing, classified: bones };
}
//# sourceMappingURL=humanoid-bone-names.js.map