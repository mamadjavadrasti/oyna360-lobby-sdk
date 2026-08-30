/** Shared Persian UI font for HUD + DynamicTexture signs. */
export const LOBBY_UI_FONT = 'Vazirmatn, Tahoma, sans-serif';

const FONT_HREF =
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css';

export function lobbyCanvasFont(px: number, weight = 'bold') {
  return `${weight} ${px}px ${LOBBY_UI_FONT}`;
}

export async function ensureLobbyPersianFont(): Promise<void> {
  if (typeof document === 'undefined') return;

  const already = document.fonts.check('16px Vazirmatn');
  if (!already && !document.querySelector('link[data-lobby-font]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    link.dataset.lobbyFont = '1';
    document.head.append(link);
  }

  try {
    await document.fonts.load(`700 48px ${LOBBY_UI_FONT}`);
    await document.fonts.ready;
  } catch {
    /* canvas falls back to Tahoma */
  }
}
