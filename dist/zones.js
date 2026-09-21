export class ZoneManager {
    zones = [];
    addZone(options) {
        this.zones.push({ ...options, inside: new Set() });
    }
    updatePlayer(playerId, position) {
        for (const zone of this.zones) {
            const inside = this.isInside(position, zone.bounds);
            const wasInside = zone.inside.has(playerId);
            if (inside && !wasInside) {
                zone.inside.add(playerId);
                zone.onEnter?.(playerId);
            }
            else if (!inside && wasInside) {
                zone.inside.delete(playerId);
                zone.onExit?.(playerId);
            }
        }
    }
    isInside(pos, bounds) {
        return (pos.x >= bounds.min.x &&
            pos.x <= bounds.max.x &&
            pos.y >= bounds.min.y &&
            pos.y <= bounds.max.y &&
            pos.z >= bounds.min.z &&
            pos.z <= bounds.max.z);
    }
    clear() {
        this.zones.length = 0;
    }
}
export class PortalManager {
    portals = [];
    /** Registers a portal. Hits fire `onTrigger` only — no browser navigation. */
    addPortal(options) {
        this.portals.push({
            ...options,
            radius: options.radius ?? 1.5,
            triggered: new Set(),
        });
    }
    updatePlayer(playerId, position) {
        const hits = [];
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
            }
            else if (!inside) {
                portal.triggered.delete(playerId);
            }
        }
        return hits;
    }
    clear() {
        this.portals.length = 0;
    }
}
//# sourceMappingURL=zones.js.map