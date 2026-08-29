import type { Vector3 } from './types';

export class ZoneManager {
  private readonly zones: Array<{
    id: string;
    bounds: { min: Vector3; max: Vector3 };
    onEnter?: (playerId: string) => void;
    onExit?: (playerId: string) => void;
    inside: Set<string>;
  }> = [];

  addZone(options: {
    id: string;
    bounds: { min: Vector3; max: Vector3 };
    onEnter?: (playerId: string) => void;
    onExit?: (playerId: string) => void;
  }) {
    this.zones.push({ ...options, inside: new Set() });
  }

  updatePlayer(playerId: string, position: Vector3) {
    for (const zone of this.zones) {
      const inside = this.isInside(position, zone.bounds);
      const wasInside = zone.inside.has(playerId);

      if (inside && !wasInside) {
        zone.inside.add(playerId);
        zone.onEnter?.(playerId);
      } else if (!inside && wasInside) {
        zone.inside.delete(playerId);
        zone.onExit?.(playerId);
      }
    }
  }

  private isInside(pos: Vector3, bounds: { min: Vector3; max: Vector3 }) {
    return (
      pos.x >= bounds.min.x &&
      pos.x <= bounds.max.x &&
      pos.y >= bounds.min.y &&
      pos.y <= bounds.max.y &&
      pos.z >= bounds.min.z &&
      pos.z <= bounds.max.z
    );
  }

  clear() {
    this.zones.length = 0;
  }
}

export class PortalManager {
  private readonly portals: Array<{
    id: string;
    position: Vector3;
    radius: number;
    toGameSlug?: string;
    toScene?: string;
    onTrigger?: () => void;
    triggered: Set<string>;
  }> = [];

  /** Registers a portal. Hits fire `onTrigger` only — no browser navigation. */
  addPortal(options: {
    id: string;
    position: Vector3;
    radius?: number;
    toGameSlug?: string;
    toScene?: string;
    onTrigger?: () => void;
  }) {
    this.portals.push({
      ...options,
      radius: options.radius ?? 1.5,
      triggered: new Set(),
    });
  }

  updatePlayer(playerId: string, position: Vector3): Array<{
    portalId: string;
    toGameSlug?: string;
    toScene?: string;
    onTrigger?: () => void;
  }> {
    const hits: Array<{
      portalId: string;
      toGameSlug?: string;
      toScene?: string;
      onTrigger?: () => void;
    }> = [];

    for (const portal of this.portals) {
      const dx = position.x - portal.position.x;
      const dz = position.z - portal.position.z;
      const dist = Math.hypot(dx, dz);
      const inside = dist <= portal.radius;

      if (inside && !portal.triggered.has(playerId)) {
        portal.triggered.add(playerId);
        hits.push({
          portalId: portal.id,
          toGameSlug: portal.toGameSlug,
          toScene: portal.toScene,
          onTrigger: portal.onTrigger,
        });
      } else if (!inside) {
        portal.triggered.delete(playerId);
      }
    }

    return hits;
  }

  clear() {
    this.portals.length = 0;
  }
}
