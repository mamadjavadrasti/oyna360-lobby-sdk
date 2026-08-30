import type { PlatformLobby } from '../platform-lobby';
import type { LocalPlayerController } from '../local-player-controller';
import type { Vector3 as Vec3 } from '../types';
export declare class PlaygroundSystem {
    private readonly lobby;
    private slidePrompt;
    private sliding;
    private trampolineCooldown;
    private trampGlow;
    private trampPulse;
    private ringMat;
    private padMat;
    private particleBurst;
    private keyHandler;
    private readonly slidePath;
    constructor(lobby: PlatformLobby);
    private setupParticles;
    private setupZones;
    private setupKeyboard;
    private emitPrompt;
    trySlide(): boolean;
    update(dt: number, controller: LocalPlayerController, position: Vec3): void;
    private burstParticles;
    private animate;
    dispose(): void;
}
export declare function attachPlayground(lobby: PlatformLobby): PlaygroundSystem;
//# sourceMappingURL=playground-system.d.ts.map