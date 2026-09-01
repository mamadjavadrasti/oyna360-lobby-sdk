import { LOBBY_UI_FONT } from './lobby-font';
import { formatPlayerLabel } from './player-label';
const MAX_ITEMS = 5;
const ITEM_MS = 4500;
export function attachLobbyPresenceUi(lobby) {
    const root = ensurePresenceRoot(lobby);
    const timers = new Set();
    const push = (text, kind) => {
        const item = document.createElement('div');
        item.dataset.kind = kind;
        item.textContent = text;
        item.style.cssText = [
            'padding:7px 11px',
            'border-radius:10px',
            `font:12px/1.45 ${LOBBY_UI_FONT}`,
            'color:#fff',
            'background:rgba(8,8,20,.82)',
            'border:1px solid',
            kind === 'join' ? 'border-color:rgba(74,222,128,.45)' : 'border-color:rgba(248,113,113,.45)',
            'box-shadow:0 8px 18px rgba(0,0,0,.28)',
            'animation:oynaLobbyPresenceIn .22s ease-out',
        ].join(';');
        root.prepend(item);
        while (root.childElementCount > MAX_ITEMS)
            root.lastElementChild?.remove();
        const timer = window.setTimeout(() => {
            item.remove();
            timers.delete(timer);
        }, ITEM_MS);
        timers.add(timer);
    };
    const offJoin = lobby.on('playerJoined', ({ displayName, username }) => {
        push(`${formatPlayerLabel(displayName, username)} وارد لابی شد`, 'join');
    });
    const offLeave = lobby.on('playerLeft', ({ displayName, username }) => {
        push(`${formatPlayerLabel(displayName, username)} از لابی خارج شد`, 'leave');
    });
    return () => {
        for (const timer of timers)
            window.clearTimeout(timer);
        timers.clear();
        offJoin();
        offLeave();
        if (root.dataset.lobbyPresenceDynamic === '1')
            root.remove();
        else
            root.replaceChildren();
    };
}
function ensurePresenceRoot(lobby) {
    const existing = document.getElementById('oyna-lobby-presence');
    if (existing)
        return existing;
    const root = document.createElement('div');
    root.id = 'oyna-lobby-presence';
    root.dataset.lobbyPresenceDynamic = '1';
    root.setAttribute('aria-live', 'polite');
    root.style.cssText = [
        'position:absolute',
        'top:64px',
        'left:14px',
        'z-index:19',
        'display:flex',
        'flex-direction:column',
        'gap:6px',
        'max-width:min(260px,42vw)',
        'pointer-events:none',
        'direction:rtl',
    ].join(';');
    const mount = document.getElementById('oyna-lobby-hud') ??
        lobby.getEngine().getRenderingCanvas()?.parentElement ??
        document.body;
    mount.append(root);
    injectPresenceKeyframes();
    return root;
}
function injectPresenceKeyframes() {
    if (document.getElementById('oyna-lobby-presence-style'))
        return;
    const style = document.createElement('style');
    style.id = 'oyna-lobby-presence-style';
    style.textContent = `@keyframes oynaLobbyPresenceIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.append(style);
}
//# sourceMappingURL=lobby-presence-ui.js.map