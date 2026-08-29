import type { PlatformInitMessage, SdkInitPayload } from '@platform/types';
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