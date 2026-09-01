import type { PlatformLobby } from './platform-lobby';
import { LOBBY_UI_FONT } from './lobby-font';
import { formatPlayerLabel } from './player-label';

export function attachLobbyPresenceUi(lobby: PlatformLobby): () => void {
  const hostToast = document.getElementById('oyna-lobby-toast');
  let floating: HTMLDivElement | null = null;
  let timer = 0;

  const show = (text: string, ms = 2800) => {
    if (hostToast) {
      hostToast.textContent = text;
      hostToast.classList.add('is-open');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => hostToast.classList.remove('is-open'), ms);
      return;
    }
    if (!floating) {
      floating = document.createElement('div');
      floating.style.cssText = [
        'position:absolute',
        'top:56px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:25',
        'max-width:min(320px,calc(100% - 32px))',
        'padding:8px 14px',
        'border-radius:12px',
        'background:rgba(15,23,42,.88)',
        'border:1px solid rgba(168,85,247,.4)',
        `font:13px/1.45 ${LOBBY_UI_FONT}`,
        'color:#fff',
        'text-align:center',
        'pointer-events:none',
        'direction:rtl',
      ].join(';');
      const mount = document.getElementById('oyna-lobby-hud') ?? lobby.getEngine().getRenderingCanvas()?.parentElement;
      if (mount) mount.append(floating);
    }
    if (!floating) return;
    floating.textContent = text;
    floating.style.display = 'block';
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (floating) floating.style.display = 'none';
    }, ms);
  };

  const offJoin = lobby.on('playerJoined', ({ displayName, username }) => {
    show(`${formatPlayerLabel(displayName, username)} وارد لابی شد`);
  });

  const offLeave = lobby.on('playerLeft', ({ displayName, username }) => {
    show(`${formatPlayerLabel(displayName, username)} از لابی خارج شد`);
  });

  return () => {
    window.clearTimeout(timer);
    offJoin();
    offLeave();
    floating?.remove();
    floating = null;
  };
}
