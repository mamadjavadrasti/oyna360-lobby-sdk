/** Yield so the Babylon render loop can paint (placeholder / prior frame) before heavy sync work. */
export function yieldToRenderLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      return;
    }
    setTimeout(resolve, 0);
  });
}
