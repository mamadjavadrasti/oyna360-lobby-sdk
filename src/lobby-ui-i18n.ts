export type LobbyUiLocale = 'fa' | 'en';

export type LobbyUiMessages = {
  presenceJoined: string;
  presenceLeft: string;
  connectionLost: string;
  connectionRetry: string;
  connectionReconnecting: string;
  orientationHint: string;
};

const FA: LobbyUiMessages = {
  presenceJoined: 'وارد لابی شد',
  presenceLeft: 'از لابی خارج شد',
  connectionLost: 'اتصال قطع شد',
  connectionRetry: 'تلاش مجدد',
  connectionReconnecting: 'در حال اتصال مجدد…',
  orientationHint: 'گوشیت رو افقی بگیر',
};

const EN: LobbyUiMessages = {
  presenceJoined: 'joined the lobby',
  presenceLeft: 'left the lobby',
  connectionLost: 'Connection lost',
  connectionRetry: 'Retry',
  connectionReconnecting: 'Reconnecting…',
  orientationHint: 'Rotate your device to landscape',
};

const LOCALES: Record<LobbyUiLocale, LobbyUiMessages> = { fa: FA, en: EN };

export function resolveLobbyUiMessages(
  locale: LobbyUiLocale = 'fa',
  overrides?: Partial<LobbyUiMessages>,
): LobbyUiMessages {
  return { ...LOCALES[locale] ?? FA, ...overrides };
}
