import '@babylonjs/loaders/glTF';
import type { SdkInitPayload } from './platform-types';
import { type LobbyEmoteKind } from './protocol';
import { LocalPlayerController } from './local-player-controller';
import type { LobbyPlugin } from './types';
import { type StarterLayoutConfig } from './starter-layout';
import { type PlazaLayoutConfig } from './plaza-layout';
import type { LobbyEventMap, LobbyEventName, LobbyPortalOptions, LobbyZoneOptions, PlatformLobbyConfig, PlatformLobbyCreateOptions, PlatformLobbyDevOptions, Vector3 } from './types';
export declare class PlatformLobby {
    private readonly canvas;
    private readonly init;
    private readonly config;
    private readonly roomId;
    private readonly wsUrl;
    private sceneManager;
    private localAvatar;
    private localController;
    private remotePlayers;
    private network;
    private zoneManager;
    private portalManager;
    private plugins;
    private overlayHandlers;
    private listeners;
    private lastNetworkSend;
    private destroyed;
    private ready;
    private playground;
    private music;
    private chatDispose;
    private presenceDispose;
    private resizeHandler;
    private constructor();
    static create(options: PlatformLobbyCreateOptions): Promise<PlatformLobby>;
    static createFromPlatform(canvas: HTMLCanvasElement, config?: PlatformLobbyConfig): Promise<PlatformLobby>;
    static createDev(options: PlatformLobbyDevOptions): Promise<PlatformLobby>;
    private bootstrap;
    private connectNetwork;
    on<E extends LobbyEventName>(event: E, handler: (payload: LobbyEventMap[E]) => void): () => void;
    off<E extends LobbyEventName>(event: E, handler: (payload: LobbyEventMap[E]) => void): void;
    private emit;
    use(plugin: LobbyPlugin): this;
    /** Optional starter-plaza template. Appearance and start routing stay in the game. */
    applyPlazaLayout(config?: PlazaLayoutConfig): this;
    applyStarterLayout(config?: StarterLayoutConfig): this;
    attachDebug(win?: Window): import("./lobby-debug").LobbyDebugHandle;
    getDebugReport(): import("./lobby-debug").LobbyDebugReport;
    addZone(options: LobbyZoneOptions): void;
    /**
     * Game-owned portal. The SDK only detects the player and fires `onTrigger` / `portalTrigger`.
     * It never navigates the browser — the game starts its own gameplay.
     */
    addPortal(options: LobbyPortalOptions): void;
    /** Platform identity: user, avatar, session, room. */
    getSession(): import("./platform-types").SdkSession;
    getUser(): import("./platform-types").SdkUser;
    getAvatar(): import("./platform-types").SdkLobbyAvatar;
    /** Other players currently synced in this lobby room. */
    getPlayers(): {
        userId: string;
        displayName: string;
        avatar: import("./protocol").SdkLobbyAvatar;
        position: {
            x: number;
            y: number;
            z: number;
        };
        rotationY: number;
        animation: import("./protocol").LobbyAnimationState;
    }[];
    loadGLB(url: string, name?: string): Promise<import("@babylonjs/core").AbstractMesh>;
    onOverlay(id: string, handler: (payload: unknown) => void): void;
    emitOverlay(id: string, payload: unknown): void;
    playEmote(emote: LobbyEmoteKind): void;
    /** Live lobby chat. Not saved. Always echoes locally so the sender sees the line. */
    sendChat(text: string): boolean;
    attachChat(): this;
    /** Virtual joystick / on-screen pad. x = strafe, z = forward (-1..1). */
    setMoveStick(x: number, z: number): void;
    setLookStick(x: number, y: number): void;
    addLookDelta(dx: number, dy: number): void;
    tryPlaygroundInteract(): boolean;
    getLocalController(): LocalPlayerController;
    noteMusicToggle(): void;
    toggleMusic(): boolean;
    setMusicMuted(muted: boolean): void;
    isMusicMuted(): boolean;
    jump(): void;
    setJumpHeld(on: boolean): void;
    setSprint(on: boolean): void;
    /** Ask the hub to close this lobby iframe and return home. Never navigates itself. */
    requestExit(): void;
    getInitPayload(): SdkInitPayload;
    getLocalPose(): {
        position: {
            x: number;
            y: number;
            z: number;
        };
        rotationY: number;
        animation: import("./protocol").LobbyAnimationState;
    };
    getScene(): import("@babylonjs/core").Scene;
    getEngine(): import("@babylonjs/core").Engine;
    addMeshAt(position: Vector3, size?: number): import("@babylonjs/core").Mesh;
    destroy(): void;
}
//# sourceMappingURL=platform-lobby.d.ts.map