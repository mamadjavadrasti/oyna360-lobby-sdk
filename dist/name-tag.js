import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, } from '@babylonjs/core';
import { lobbyCanvasFont } from './lobby-font';
export function attachNameTag(scene, parent, label, id) {
    const text = label.trim().slice(0, 24) || 'بازیکن';
    const plane = MeshBuilder.CreatePlane(`${id}-nametag`, { width: 2.2, height: 0.48 }, scene);
    plane.parent = parent;
    plane.position.y = 2.32;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    plane.checkCollisions = false;
    const tex = new DynamicTexture(`${id}-nametag-tex`, { width: 512, height: 128 }, scene, false);
    tex.hasAlpha = true;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 512, 128);
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = lobbyCanvasFont(48);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 256, 64);
    tex.update();
    const mat = new StandardMaterial(`${id}-nametag-mat`, scene);
    mat.diffuseTexture = tex;
    mat.opacityTexture = tex;
    mat.emissiveColor = new Color3(0.92, 0.92, 0.92);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;
    mat.transparencyMode = 2;
    plane.material = mat;
    return plane;
}
//# sourceMappingURL=name-tag.js.map