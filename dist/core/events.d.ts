type Handler<T> = (payload: T) => void;
/** Minimal typed emitter for Core (no DOM EventTarget required). */
export declare class LobbyEmitter<EventMap extends Record<string, unknown>> {
    private readonly handlers;
    on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void;
    off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void;
    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
    clear(): void;
}
export {};
//# sourceMappingURL=events.d.ts.map