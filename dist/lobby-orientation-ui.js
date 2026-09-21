import { LOBBY_UI_FONT, ensureLobbyPersianFont } from './lobby-font';
import { resolveLobbyUiMessages } from './lobby-ui-i18n';
/**
 * On mobile portrait, shows a full-screen landscape prompt.
 * Auto-hides when the device goes landscape or on desktop.
 */
export function attachLobbyOrientationUi(options) {
    if (typeof window === 'undefined')
        return () => { };
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile)
        return () => { };
    void ensureLobbyPersianFont();
    const copy = resolveLobbyUiMessages(options?.locale ?? 'fa', options?.messages);
    const overlay = document.createElement('div');
    overlay.id = 'oyna-lobby-orientation-overlay';
    const locale = options?.locale ?? 'fa';
    overlay.style.cssText = [
        'display:none',
        'position:fixed',
        'inset:0',
        'z-index:99999',
        'background:rgba(0,0,0,.88)',
        'color:#fff',
        `font:700 18px/1.6 ${LOBBY_UI_FONT}`,
        locale === 'en' ? 'direction:ltr' : 'direction:rtl',
        'text-align:center',
        'place-items:center',
    ].join(';');
    const box = document.createElement('div');
    box.style.cssText = 'padding:32px';
    const icon = document.createElement('div');
    icon.textContent = '📱';
    icon.style.cssText = 'font-size:48px;margin-bottom:16px;animation:oyna-rotate-phone 1.2s ease-in-out infinite alternate';
    const text = document.createElement('p');
    text.textContent = copy.orientationHint;
    text.style.cssText = 'margin:0;font-size:18px';
    box.append(icon, text);
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
//# sourceMappingURL=lobby-orientation-ui.js.map