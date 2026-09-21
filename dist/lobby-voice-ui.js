import { LOBBY_UI_FONT, ensureLobbyPersianFont } from './lobby-font';
const ICON_BTN = `pointer-events:auto;width:42px;height:42px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(8,8,20,.55);color:#fff;font-size:16px;cursor:pointer;display:grid;place-items:center;padding:0;font-family:${LOBBY_UI_FONT}`;
function voiceErrorMessage(err) {
    const raw = err instanceof Error ? err.message : String(err ?? '');
    const lower = raw.toLowerCase();
    if (lower.includes('permission') || lower.includes('notallowed') || lower.includes('denied')) {
        return 'دسترسی میکروفون مسدود است — اجازه میکروفون را در مرورگر فعال کنید';
    }
    if (lower.includes('not supported') || lower.includes('mediaDevices')) {
        return 'این مرورگر از میکروفون پشتیبانی نمی‌کند';
    }
    return raw.trim() || 'فعال‌سازی ویس ممکن نیست';
}
export function attachLobbyVoiceUi(lobby) {
    void ensureLobbyPersianFont();
    const voice = lobby.getVoiceChat();
    if (!voice)
        return () => undefined;
    const anchor = document.getElementById('oyna-lobby-voice-anchor');
    if (!anchor)
        return () => undefined;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:42px;height:42px;pointer-events:auto';
    const mic = document.createElement('button');
    mic.type = 'button';
    mic.title = 'ویس';
    mic.setAttribute('aria-label', 'ویس');
    mic.style.cssText = ICON_BTN;
    const mode = document.createElement('select');
    mode.title = 'محدوده ویس';
    mode.style.cssText =
        `position:absolute;left:calc(100% + 6px);top:0;height:42px;min-width:88px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(8,8,20,.55);color:#fff;font:12px ${LOBBY_UI_FONT};padding:0 8px;cursor:pointer;pointer-events:auto`;
    mode.innerHTML = [
        '<option value="friends">دوستان</option>',
        '<option value="all">همه</option>',
    ].join('');
    const sync = () => {
        const state = voice.getState();
        mode.value = state.mode;
        mode.disabled = state.active;
        if (!state.active) {
            mic.textContent = '🎙️';
            mic.title = 'روشن کردن ویس';
            mic.style.borderColor = 'rgba(255,255,255,.14)';
            mic.style.background = 'rgba(8,8,20,.55)';
            return;
        }
        mic.textContent = state.muted ? '🔇' : '🎤';
        mic.title = state.muted ? 'میکروفون خاموش — کلیک برای روشن' : 'ویس روشن — کلیک برای قطع';
        mic.style.borderColor = state.muted ? 'rgba(248,113,113,.45)' : 'rgba(74,222,128,.45)';
        mic.style.background = state.muted ? 'rgba(127,29,29,.55)' : 'rgba(20,83,45,.55)';
    };
    mic.addEventListener('click', async (e) => {
        if (e.button !== 0)
            return;
        e.preventDefault();
        e.stopPropagation();
        const state = voice.getState();
        try {
            if (!lobby.canUseVoice()) {
                showVoiceToast('دسترسی به ویس لابی برای شما فعال نیست');
                return;
            }
            if (!state.active) {
                await voice.enable(mode.value);
                return;
            }
            await voice.disable();
        }
        catch (err) {
            showVoiceToast(voiceErrorMessage(err));
        }
    });
    mode.addEventListener('change', async () => {
        try {
            await voice.setMode(mode.value);
        }
        catch (err) {
            showVoiceToast(voiceErrorMessage(err));
        }
    });
    wrap.append(mic, mode);
    anchor.replaceChildren(wrap);
    const syncAccess = () => {
        anchor.style.display = lobby.canUseVoice() ? '' : 'none';
    };
    syncAccess();
    const offConnected = lobby.on('connected', syncAccess);
    const off = voice.onStateChange(sync);
    sync();
    return () => {
        off();
        offConnected();
        anchor.replaceChildren();
    };
}
function showVoiceToast(text, ms = 2600) {
    const toast = document.getElementById('oyna-lobby-toast');
    if (!toast)
        return;
    toast.textContent = text;
    toast.classList.add('is-open');
    window.setTimeout(() => toast.classList.remove('is-open'), ms);
}
//# sourceMappingURL=lobby-voice-ui.js.map