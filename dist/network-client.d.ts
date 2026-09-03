import type { LobbyEmoteKind, LobbyFeatureFlags, LobbyMoveMessage, LobbyPlayerState, LobbyVoiceMode, LobbyVoicePeerState, RtcIceCandidate, RtcSessionDescription } from './protocol';
export type NetworkClientHandlers = {
    onWelcome?: (self: LobbyPlayerState, players: LobbyPlayerState[], meta?: {
        friendUserIds?: string[];
        voicePeers?: LobbyVoicePeerState[];
        lobbyFeatures?: LobbyFeatureFlags;
    }) => void;
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
    onVoiceState?: (peers: LobbyVoicePeerState[], friendUserIds: string[]) => void;
    onVoiceJoined?: (peer: LobbyVoicePeerState) => void;
    onVoiceLeft?: (userId: string) => void;
    onVoiceMute?: (userId: string, muted: boolean) => void;
    onVoiceOffer?: (fromUserId: string, sdp: RtcSessionDescription) => void;
    onVoiceAnswer?: (fromUserId: string, sdp: RtcSessionDescription) => void;
    onVoiceIce?: (fromUserId: string, candidate: RtcIceCandidate) => void;
    onError?: (code: string, message: string) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onReconnecting?: (attempt: number) => void;
    onReconnectFailed?: () => void;
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
    sendVoiceJoin(mode: LobbyVoiceMode): void;
    sendVoiceLeave(): void;
    sendVoiceMute(muted: boolean): void;
    sendVoiceOffer(toUserId: string, sdp: RtcSessionDescription): void;
    sendVoiceAnswer(toUserId: string, sdp: RtcSessionDescription): void;
    sendVoiceIce(toUserId: string, candidate: RtcIceCandidate): void;
    ping(): void;
    disconnect(): void;
    isConnected(): boolean;
}
//# sourceMappingURL=network-client.d.ts.map