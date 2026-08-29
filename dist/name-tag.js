import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, } from '@babylonjs/core';
export function attachNameTag(scene, parent, label, id) {
    const text = label.trim().slice(0, 24) || 'Player';
    const plane = MeshBuilder.CreatePlane(`${id}-nametag`, { width: 2.4, height: 0.55 }, scene);
    plane.parent = parent;
    plane.position.y = 2.35;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const tex = new DynamicTexture(`${id}-nametag-tex`, { width: 512, height: 128 }, scene, false);
    tex.hasAlpha = true;
    const ctx = tex.getContext();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 16, 496, 96);
    tex.drawText(text, 256, 78, 'bold 44px Arial', '#ffffff', 'transparent', true, true);
    const mat = new StandardMaterial(`${id}-nametag-mat`, scene);
    mat.diffuseTexture = tex;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;
    plane.material = mat;
    return plane;
}
//# sourceMappingURL=name-tag.js.map