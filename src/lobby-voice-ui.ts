import type { PlatformLobby } from './platform-lobby';
import { LOBBY_UI_FONT, ensureLobbyPersianFont } from './lobby-font';
import type { LobbyVoiceMode } from './protocol';

const ICON_BTN =
  `pointer-events:auto;width:42px;height:42px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(8,8,20,.55);color:#fff;font-size:16px;cursor:pointer;display:grid;place-items:center;padding:0;font-family:${LOBBY_UI_FONT}`;

export function attachLobbyVoiceUi(lobby: PlatformLobby): () => void {
  void ensureLobbyPersianFont();

  const voice = lobby.getVoiceChat();
  if (!voice) return () => undefined;

  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:absolute;top:14px;left:118px;display:flex;gap:6px;align-items:center;pointer-events:auto;direction:ltr;z-index:20';

  const mic = document.createElement('button');
  mic.type = 'button';
  mic.title = 'صدا';
  mic.setAttribute('aria-label', 'صدا');
  mic.style.cssText = ICON_BTN;

  const mode = document.createElement('select');
  mode.title = 'محدوده صدا';
  mode.style.cssText =
    `height:42px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(8,8,20,.55);color:#fff;font:12px ${LOBBY_UI_FONT};padding:0 8px;cursor:pointer`;
  mode.innerHTML = [
    '<option value="friends">دوستان</option>',
    '<option value="all">همه لابی</option>',
  ].join('');

  const sync = () => {
    const state = voice.getState();
    mode.value = state.mode;
    mode.disabled = state.active;
    if (!state.active) {
      mic.textContent = '🎙️';
      mic.title = 'فعال‌سازی صدا';
      mic.style.borderColor = 'rgba(255,255,255,.14)';
      mic.style.background = 'rgba(8,8,20,.55)';
      return;
    }
    mic.textContent = state.muted ? '🔇' : '🎤';
    mic.title = state.muted ? 'میکروفون خاموش — کلیک برای روشن' : 'میکروفون روشن — کلیک برای خاموش · Shift+کلیک برای قطع صدا';
    mic.style.borderColor = state.muted ? 'rgba(248,113,113,.45)' : 'rgba(74,222,128,.45)';
    mic.style.background = state.muted ? 'rgba(127,29,29,.55)' : 'rgba(20,83,45,.55)';
  };

  mic.addEventListener('click', async (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const state = voice.getState();
    try {
      if (!state.active) {
        await voice.enable(mode.value as LobbyVoiceMode);
        return;
      }
      if (e.shiftKey) {
        await voice.disable();
        return;
      }
      voice.toggleMicMuted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'دسترسی به میکروفون ممکن نیست';
      showVoiceToast(msg);
    }
  });

  mode.addEventListener('change', async () => {
    try {
      await voice.setMode(mode.value as LobbyVoiceMode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تغییر حالت صدا ممکن نیست';
      showVoiceToast(msg);
    }
  });

  wrap.append(mic, mode);

  const mount =
    document.getElementById('oyna-lobby-hud') ??
    lobby.getEngine().getRenderingCanvas()?.parentElement ??
    document.body;
  mount.append(wrap);

  const off = voice.onStateChange(sync);
  sync();

  return () => {
    off();
    wrap.remove();
  };
}

function showVoiceToast(text: string, ms = 2600) {
  const toast = document.getElementById('oyna-lobby-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('is-open');
  window.setTimeout(() => toast.classList.remove('is-open'), ms);
}
