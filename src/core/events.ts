type Handler<T> = (payload: T) => void;

/** Minimal typed emitter for Core (no DOM EventTarget required). */
export class LobbyEmitter<EventMap extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof EventMap, Set<Handler<unknown>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>) {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>) {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  clear() {
    this.handlers.clear();
  }
}
