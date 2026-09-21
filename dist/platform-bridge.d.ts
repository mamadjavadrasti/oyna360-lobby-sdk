import type { PlatformInitMessage, SdkInitPayload } from './platform-types';
declare global {
    interface Window {
        __OYNA360_PLATFORM_INIT__?: PlatformInitMessage;
        /** Set only when init was stored from a trusted source (parent or same-window publish). */
        __OYNA360_PLATFORM_INIT_OK__?: boolean;
        __OYNA360_DEV__?: {
            platformUrl?: string;
            platformWebUrl?: string;
            gameSlug?: string;
        };
    }
}
export declare class PlatformBridge {
    static waitForInit(timeoutMs?: number): Promise<PlatformInitMessage>;
    static fromInit(init: SdkInitPayload | PlatformInitMessage): SdkInitPayload;
    static createDevInit(options: {
        mockUser?: Partial<SdkInitPayload['user']>;
        mockAvatar?: Partial<SdkInitPayload['avatar']>;
        gameSlug?: string;
        gameName?: string;
    }): SdkInitPayload;
}
//# sourceMappingURL=platform-bridge.d.ts.map