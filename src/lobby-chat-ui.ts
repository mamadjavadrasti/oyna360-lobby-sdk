import type { PlatformLobby } from './platform-lobby';
import { LOBBY_CHAT_MAX_LEN } from './protocol';

export function attachLobbyChatUi(lobby: PlatformLobby, canvas: HTMLCanvasElement) {
  const host = canvas.parentElement ?? document.body;
  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }

  const root = document.createElement('div');
  root.dataset.lobbyChat = '1';
  root.style.cssText = [
    'position:absolute',
    'inset:auto 12px 18px auto',
    'left:12px',
    'right:auto',
    'bottom:18px',
    'z-index:30',
    'font:12px/1.45 Tahoma,sans-serif',
    'color:#fff',
    'direction:rtl',
    'pointer-events:none',
  ].join(';');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = '💬';
  toggle.title = 'چت لابی';
  toggle.style.cssText =
    'pointer-events:auto;width:42px;height:42px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(8,8,20,.55);color:#fff;font-size:16px;cursor:pointer';

  const panel = document.createElement('div');
  panel.style.cssText =
    'display:none;pointer-events:auto;margin-bottom:8px;width:260px;background:rgba(8,8,20,.78);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px';

  const log = document.createElement('div');
  log.style.cssText = 'height:140px;overflow:auto;margin-bottom:8px';

  const form = document.createElement('form');
  form.style.cssText = 'display:flex;gap:6px';

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = LOBBY_CHAT_MAX_LEN;
  input.autocomplete = 'off';
  input.placeholder = 'پیام به لابی…';
  input.style.cssText =
    'flex:1;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(0,0,0,.28);color:#fff;padding:6px 8px;font:12px Tahoma,sans-serif';

  const send = document.createElement('button');
  send.type = 'submit';
  send.textContent = 'ارسال';
  send.style.cssText =
    'border:0;border-radius:10px;background:#7c3aed;color:#fff;padding:6px 10px;cursor:pointer';

  form.append(input, send);
  panel.append(log, form);
  root.append(panel, toggle);
  host.append(root);

  const open = () => {
    panel.style.display = 'block';
    input.focus();
  };

  toggle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (panel.style.display === 'none') open();
    else panel.style.display = 'none';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (lobby.sendChat(input.value)) input.value = '';
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
    while (log.childElementCount > 40) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
    open();
  });

  return () => {
    off();
    root.remove();
  };
}
