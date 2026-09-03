import type { PlatformLobby } from './platform-lobby';
import { LOBBY_UI_FONT, ensureLobbyPersianFont } from './lobby-font';

/**
 * Full-screen connection status overlay.
 * Shows when disconnected / reconnecting / reconnect failed.
 */
export function attachLobbyConnectionUi(lobby: PlatformLobby): () => void {
  void ensureLobbyPersianFont();

  const overlay = document.createElement('div');
  overlay.id = 'oyna-lobby-connection-overlay';
  overlay.style.cssText = [
    'display:none',
    'position:fixed',
    'inset:0',
    'z-index:9999',
    'background:rgba(0,0,0,.72)',
    'color:#fff',
    `font:700 16px/1.5 ${LOBBY_UI_FONT}`,
    'direction:rtl',
    'text-align:center',
    'place-items:center',
    'pointer-events:auto',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText =
    'background:rgba(8,8,20,.85);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:24px 32px;max-width:320px';

  const msg = document.createElement('p');
  msg.style.cssText = 'margin:0 0 8px;font-size:16px';

  const sub = document.createElement('p');
  sub.style.cssText = 'margin:0;font-size:13px;opacity:.7';

  box.append(msg, sub);
  overlay.append(box);
  document.body.append(overlay);

  let failed = false;

  const show = (text: string, detail: string) => {
    msg.textContent = text;
    sub.textContent = detail;
    overlay.style.display = 'grid';
  };
  const hide = () => {
    overlay.style.display = 'none';
    failed = false;
  };

  const offDisconnected = lobby.on('disconnected', () => {
    if (failed) return;
    show('اتصال قطع شد', 'در حال تلاش مجدد…');
  });

  const offReconnecting = lobby.on('reconnecting', ({ attempt }) => {
    show('اتصال قطع شد', `تلاش مجدد ${attempt}…`);
  });

  const offReconnectFailed = lobby.on('reconnectFailed', () => {
    failed = true;
    show('اتصال برقرار نشد', 'لطفاً اتصال اینترنت خود را بررسی کنید');
  });

  const offConnected = lobby.on('connected', () => {
    hide();
  });

  return () => {
    offDisconnected();
    offReconnecting();
    offReconnectFailed();
    offConnected();
    overlay.remove();
  };
}
