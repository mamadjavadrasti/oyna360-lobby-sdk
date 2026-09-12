const FA = {
    presenceJoined: 'وارد لابی شد',
    presenceLeft: 'از لابی خارج شد',
    connectionLost: 'اتصال قطع شد',
    connectionRetry: 'تلاش مجدد',
    connectionReconnecting: 'در حال اتصال مجدد…',
    orientationHint: 'گوشیت رو افقی بگیر',
};
const EN = {
    presenceJoined: 'joined the lobby',
    presenceLeft: 'left the lobby',
    connectionLost: 'Connection lost',
    connectionRetry: 'Retry',
    connectionReconnecting: 'Reconnecting…',
    orientationHint: 'Rotate your device to landscape',
};
const LOCALES = { fa: FA, en: EN };
export function resolveLobbyUiMessages(locale = 'fa', overrides) {
    return { ...LOCALES[locale] ?? FA, ...overrides };
}
//# sourceMappingURL=lobby-ui-i18n.js.map