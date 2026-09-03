import { LOBBY_UI_FONT, ensureLobbyPersianFont } from './lobby-font';

/**
 * On mobile portrait, shows a full-screen prompt: "گوشیت رو افقی بگیر".
 * Auto-hides when the device goes landscape or on desktop.
 */
export function attachLobbyOrientationUi(): () => void {
  if (typeof window === 'undefined') return () => {};

  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
  if (!isMobile) return () => {};

  void ensureLobbyPersianFont();

  const overlay = document.createElement('div');
  overlay.id = 'oyna-lobby-orientation-overlay';
  overlay.style.cssText = [
    'display:none',
    'position:fixed',
    'inset:0',
    'z-index:99999',
    'background:rgba(0,0,0,.88)',
    'color:#fff',
    `font:700 18px/1.6 ${LOBBY_UI_FONT}`,
    'direction:rtl',
    'text-align:center',
    'place-items:center',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = 'padding:32px';

  const icon = document.createElement('div');
  icon.textContent = '📱';
  icon.style.cssText = 'font-size:48px;margin-bottom:16px;animation:oyna-rotate-phone 1.2s ease-in-out infinite alternate';

  const text = document.createElement('p');
  text.textContent = 'گوشیت رو افقی بگیر';
  text.style.cssText = 'margin:0;font-size:18px';

  const hint = document.createElement('p');
  hint.textContent = 'لابی برای حالت افقی طراحی شده';
  hint.style.cssText = 'margin:8px 0 0;font-size:13px;opacity:.6';

  box.append(icon, text, hint);
  overlay.append(box);
  document.body.append(overlay);

  // CSS animation for rotating phone icon
  const style = document.createElement('style');
  style.textContent = `
    @keyframes oyna-rotate-phone {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(90deg); }
    }
  `;
  document.head.append(style);

  const check = () => {
    const portrait = window.innerHeight > window.innerWidth;
    overlay.style.display = portrait ? 'grid' : 'none';
  };

  check();
  window.addEventListener('resize', check);
  screen.orientation?.addEventListener('change', check);

  return () => {
    window.removeEventListener('resize', check);
    screen.orientation?.removeEventListener('change', check);
    overlay.remove();
    style.remove();
  };
}
