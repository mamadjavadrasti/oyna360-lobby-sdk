import type { LobbyVoiceMode, LobbyVoicePeerState, RtcIceCandidate, RtcSessionDescription } from './protocol';
export type VoiceSignaling = {
    sendJoin(mode: LobbyVoiceMode): void;
    sendLeave(): void;
    sendMute(muted: boolean): void;
    sendOffer(toUserId: string, sdp: RtcSessionDescription): void;
    sendAnswer(toUserId: string, sdp: RtcSessionDescription): void;
    sendIce(toUserId: string, candidate: RtcIceCandidate): void;
};
export type VoiceChatState = {
    active: boolean;
    mode: LobbyVoiceMode;
    muted: boolean;
    peerCount: number;
};
export type VoiceChatListener = (state: VoiceChatState) => void;
export declare class LobbyVoiceChat {
    private readonly signaling;
    private localStream;
    private readonly peers;
    private readonly remoteAudio;
    private readonly voicePeers;
    private active;
    private mode;
    private micMuted;
    private selfUserId;
    private friendIds;
    private readonly listeners;
    private disposed;
    constructor(signaling: VoiceSignaling);
    onStateChange(listener: VoiceChatListener): () => boolean;
    setContext(selfUserId: string, friendUserIds: string[]): void;
    getState(): VoiceChatState;
    enable(mode: LobbyVoiceMode): Promise<void>;
    disable(): Promise<void>;
    setMode(mode: LobbyVoiceMode): Promise<void>;
    setMicMuted(muted: boolean): void;
    toggleMicMuted(): void;
    handleVoiceState(peers: LobbyVoicePeerState[], friendUserIds: string[]): void;
    handleVoiceJoined(peer: LobbyVoicePeerState): void;
    handleVoiceLeft(userId: string): void;
    handleVoiceMute(userId: string, muted: boolean): void;
    handleOffer(fromUserId: string, sdp: RtcSessionDescription): Promise<void>;
    handleAnswer(fromUserId: string, sdp: RtcSessionDescription): Promise<void>;
    handleIce(fromUserId: string, candidate: RtcIceCandidate): Promise<void>;
    dispose(): void;
    private syncPeerConnections;
    private canConnectTo;
    private createOffer;
    private ensurePeer;
    private closePeer;
    private teardownPeers;
    private stopLocalStream;
    private applyMicTrackState;
    private snapshot;
    private emitState;
}
//# sourceMappingURL=voice-chat.d.ts.map