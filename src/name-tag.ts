import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core';
import { lobbyCanvasFont } from './lobby-font';
import { formatAvatarTagLabel } from './player-label';

export function attachNameTag(
  scene: Scene,
  parent: TransformNode,
  displayName: string,
  username: string,
  id: string,
) {
  const label = formatAvatarTagLabel(displayName, username);
  const plane = MeshBuilder.CreatePlane(`${id}-nametag`, { width: 2.2, height: 0.48 }, scene);
  plane.parent = parent;
  plane.position.y = 2.34;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.checkCollisions = false;

  const tex = new DynamicTexture(`${id}-nametag-tex`, { width: 512, height: 128 }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const w = 512;
  const h = 128;
  ctx.clearRect(0, 0, w, h);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const pillW = Math.min(w - 24, label.length * 22 + 48);
  const pillH = 72;
  const pillX = (w - pillW) / 2;
  const pillY = (h - pillH) / 2;
  ctx.fillStyle = 'rgba(8, 8, 20, 0.78)';
  roundRect(ctx, pillX, pillY, pillW, pillH, 18);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = lobbyCanvasFont(44);
  ctx.fillText(label, w / 2, h / 2);
  tex.update();

  const mat = new StandardMaterial(`${id}-nametag-mat`, scene);
  mat.diffuseTexture = tex;
  mat.opacityTexture = tex;
  mat.emissiveColor = new Color3(0.95, 0.95, 0.95);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.useAlphaFromDiffuseTexture = true;
  mat.transparencyMode = 2;
  plane.material = mat;

  return plane;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
