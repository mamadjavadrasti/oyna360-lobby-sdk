import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3 as BVector3, } from '@babylonjs/core';
import { attachNameTag } from './name-tag';
function colorFromConfig(value, fallback) {
    return Color3.FromHexString(typeof value === 'string' ? value : fallback);
}
function solid(scene, id, hex) {
    const m = new StandardMaterial(id, scene);
    m.diffuseColor = hex;
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    return m;
}
/** Stylized blocky humanoid (Roblox-like). GLB can replace later. */
export class AvatarFactory {
    static create(scene, avatar, name = 'avatar', displayName) {
        const root = new TransformNode(name, scene);
        const config = {
            bodyColor: '#4f46e5',
            accentColor: '#f59e0b',
            pantsColor: '#1e3a5f',
            ...avatar.customConfig,
        };
        const shirt = colorFromConfig(config.bodyColor, '#4f46e5');
        const skin = colorFromConfig(config.accentColor, '#fbbf24');
        const pants = colorFromConfig(config.pantsColor, '#1e3a5f');
        const shirtMat = solid(scene, `${name}-shirt-mat`, shirt);
        const skinMat = solid(scene, `${name}-skin-mat`, skin);
        const pantsMat = solid(scene, `${name}-pants-mat`, pants);
        const hip = MeshBuilder.CreateBox(`${name}-hip`, { width: 0.55, height: 0.22, depth: 0.32 }, scene);
        hip.material = pantsMat;
        hip.parent = root;
        hip.position.y = 0.72;
        const torso = MeshBuilder.CreateBox(`${name}-body`, { width: 0.72, height: 0.7, depth: 0.38 }, scene);
        torso.material = shirtMat;
        torso.parent = root;
        torso.position.y = 1.12;
        const head = MeshBuilder.CreateBox(`${name}-head`, { width: 0.48, height: 0.48, depth: 0.48 }, scene);
        head.material = skinMat;
        head.parent = root;
        head.position.y = 1.68;
        const hair = MeshBuilder.CreateBox(`${name}-hair`, { width: 0.52, height: 0.16, depth: 0.52 }, scene);
        hair.material = solid(scene, `${name}-hair-mat`, colorFromConfig(config.hairColor, '#1f2937'));
        hair.parent = root;
        hair.position.y = 1.96;
        for (const side of [-1, 1]) {
            const arm = MeshBuilder.CreateBox(`${name}-arm-${side}`, { width: 0.2, height: 0.7, depth: 0.2 }, scene);
            arm.material = shirtMat;
            arm.parent = root;
            arm.position.set(side * 0.48, 1.08, 0);
            const hand = MeshBuilder.CreateBox(`${name}-hand-${side}`, { size: 0.18 }, scene);
            hand.material = skinMat;
            hand.parent = root;
            hand.position.set(side * 0.48, 0.68, 0);
            const leg = MeshBuilder.CreateBox(`${name}-leg-${side}`, { width: 0.22, height: 0.7, depth: 0.24 }, scene);
            leg.material = pantsMat;
            leg.parent = root;
            leg.position.set(side * 0.16, 0.35, 0);
        }
        if (displayName)
            attachNameTag(scene, root, displayName, name);
        return root;
    }
    static setPosition(root, position) {
        root.position = new BVector3(position.x, position.y, position.z);
    }
    static setRotationY(root, rotationY) {
        root.rotation.y = rotationY;
    }
}
//# sourceMappingURL=avatar-factory.js.map