import { LOBBY_UI_FONT, ensureLobbyPersianFont } from './lobby-font';
import { LOBBY_CHAT_MAX_LEN } from './protocol';
const SEND_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3.4 11.2 20.1 3.4c.7-.3 1.4.4 1.1 1.1l-7.8 16.7c-.3.7-1.3.6-1.5-.2l-1.8-6.6-6.6-1.8c-.8-.2-.9-1.2-.2-1.4Z"/></svg>';
const ICON_BTN = `pointer-events:auto;width:42px;height:42px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(8,8,20,.55);color:#fff;font-size:16px;cursor:pointer;display:grid;place-items:center;padding:0;font-family:${LOBBY_UI_FONT}`;
export function attachLobbyChatUi(lobby, canvas) {
    void ensureLobbyPersianFont();
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = '💬';
    toggle.title = 'چت لابی';
    toggle.setAttribute('aria-label', 'چت لابی');
    toggle.style.cssText = ICON_BTN;
    const panel = document.createElement('div');
    panel.style.cssText =
        `display:none;pointer-events:auto;width:260px;background:rgba(8,8,20,.78);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px;font:13px/1.5 ${LOBBY_UI_FONT};color:#fff;direction:rtl`;
    const log = document.createElement('div');
    log.style.cssText = 'height:140px;overflow:auto;margin-bottom:8px';
    const form = document.createElement('form');
    form.style.cssText = 'display:flex;gap:6px;align-items:center';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = LOBBY_CHAT_MAX_LEN;
    input.autocomplete = 'off';
    input.placeholder = 'پیام به لابی…';
    input.style.cssText =
        `flex:1;min-width:0;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(0,0,0,.28);color:#fff;padding:7px 9px;font:13px ${LOBBY_UI_FONT}`;
    const send = document.createElement('button');
    send.type = 'submit';
    send.title = 'ارسال';
    send.setAttribute('aria-label', 'ارسال');
    send.innerHTML = SEND_ICON;
    send.style.cssText =
        'flex:0 0 42px;width:42px;height:36px;border:0;border-radius:10px;background:#7c3aed;color:#fff;cursor:pointer;display:grid;place-items:center;padding:0';
    form.append(input, send);
    panel.append(log, form);
    const root = document.createElement('div');
    root.dataset.lobbyChat = '1';
    mountChatChrome(root, toggle, panel, canvas);
    const submit = () => {
        if (lobby.sendChat(input.value))
            input.value = '';
    };
    const open = () => {
        panel.style.display = 'block';
        input.focus();
    };
    const blockScene = (e) => {
        e.stopPropagation();
    };
    toggle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (panel.style.display === 'none')
            open();
        else
            panel.style.display = 'none';
    });
    form.addEventListener('pointerdown', blockScene);
    form.addEventListener('click', blockScene);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        submit();
    });
    const off = lobby.on('chat', ({ userId, displayName, text }) => {
        const row = document.createElement('p');
        row.style.margin = '0 0 6px';
        row.style.wordBreak = 'break-word';
        const who = document.createElement('b');
        who.style.color = '#c4b5fd';
        who.textContent = userId === lobby.getUser().id ? 'شما' : displayName;
        row.append(who, document.createTextNode(`: ${text}`));
        log.append(row);
        while (log.childElementCount > 40)
            log.firstElementChild?.remove();
        log.scrollTop = log.scrollHeight;
        open();
    });
    return () => {
        off();
        toggle.remove();
        root.remove();
    };
}
function mountChatChrome(root, toggle, panel, canvas) {
    const shell = [
        `z-index:30`,
        `font:13px/1.5 ${LOBBY_UI_FONT}`,
        'color:#fff',
        'direction:rtl',
        'pointer-events:none',
    ].join(';');
    const music = document.getElementById('oyna-lobby-music') || document.getElementById('music-btn');
    const dummyChat = document.querySelector('.icon-col button[title="گفتگو"]');
    dummyChat?.remove();
    if (music?.parentElement?.classList.contains('icon-col')) {
        music.insertAdjacentElement('afterend', toggle);
        const col = music.parentElement;
        const hud = col.parentElement ?? col;
        root.style.cssText = [
            'position:absolute',
            `left:${col.offsetLeft + col.offsetWidth + 8}px`,
            `top:${col.offsetTop + toggle.offsetTop}px`,
            shell,
        ].join(';');
        root.append(panel);
        hud.append(root);
        return;
    }
    if (music?.parentElement) {
        root.style.cssText = [
            'position:absolute',
            `top:${music.offsetTop + music.offsetHeight + 8}px`,
            `left:${music.offsetLeft}px`,
            'display:flex',
            'flex-direction:column',
            'gap:8px',
            'align-items:flex-start',
            shell,
        ].join(';');
        root.append(toggle, panel);
        music.parentElement.append(root);
        return;
    }
    const host = canvas.parentElement ?? document.body;
    if (getComputedStyle(host).position === 'static') {
        host.style.position = 'relative';
    }
    root.style.cssText = [
        'position:absolute',
        'top:64px',
        'left:14px',
        'display:flex',
        'flex-direction:column',
        'gap:8px',
        'align-items:flex-start',
        shell,
    ].join(';');
    root.append(toggle, panel);
    host.append(root);
}
//# sourceMappingURL=lobby-chat-ui.js.map