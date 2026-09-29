/** Minimal typed emitter for Core (no DOM EventTarget required). */
export class LobbyEmitter {
    handlers = new Map();
    on(event, handler) {
        let set = this.handlers.get(event);
        if (!set) {
            set = new Set();
            this.handlers.set(event, set);
        }
        set.add(handler);
        return () => this.off(event, handler);
    }
    off(event, handler) {
        this.handlers.get(event)?.delete(handler);
    }
    emit(event, payload) {
        const set = this.handlers.get(event);
        if (!set)
            return;
        for (const handler of [...set]) {
            handler(payload);
        }
    }
    clear() {
        this.handlers.clear();
    }
}
//# sourceMappingURL=events.js.map