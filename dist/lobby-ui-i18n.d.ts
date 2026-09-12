export type LobbyUiLocale = 'fa' | 'en';
export type LobbyUiMessages = {
    presenceJoined: string;
    presenceLeft: string;
    connectionLost: string;
    connectionRetry: string;
    connectionReconnecting: string;
    orientationHint: string;
};
export declare function resolveLobbyUiMessages(locale?: LobbyUiLocale, overrides?: Partial<LobbyUiMessages>): LobbyUiMessages;
//# sourceMappingURL=lobby-ui-i18n.d.ts.map