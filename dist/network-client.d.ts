import type { LobbyEmoteKind, LobbyMoveMessage, LobbyPlayerState } from './protocol';
export type NetworkClientHandlers = {
    onWelcome?: (self: LobbyPlayerState, players: LobbyPlayerState[]) => void;
    onPlayerJoined?: (player: LobbyPlayerState) => void;
    onPlayerLeft?: (payload: {
        userId: string;
        username?: string;
        displayName?: string;
    }) => void;
    onPlayerMoved?: (payload: {
        userId: string;
        position: LobbyPlayerState['position'];
        rotationY: number;
        animation: LobbyPlayerState['animation'];
        seq: number;
        serverTime: number;
    }) => void;
    onPlayerEmote?: (userId: string, emote: LobbyEmoteKind) => void;
    onChat?: (payload: {
        userId: string;
        username?: string;
        displayName: string;
        text: string;
        at: number;
    }) => void;
    onError?: (code: string, message: string) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
};
export declare class NetworkClient {
    private readonly wsUrl;
    private readonly roomId;
    private readonly sessionToken;
    private readonly handlers;
    private socket;
    private moveSeq;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    constructor(wsUrl: string, roomId: string, sessionToken: string, handlers?: NetworkClientHandlers);
    connect(): void;
    private handleServerMessage;
    sendMove(payload: Omit<LobbyMoveMessage, 'type' | 'seq'>): void;
    sendEmote(emote: LobbyEmoteKind): void;
    sendChat(text: string): void;
    ping(): void;
    disconnect(): void;
    isConnected(): boolean;
}
//# sourceMappingURL=network-client.d.ts.map