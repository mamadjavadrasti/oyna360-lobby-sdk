import type { LobbyVoiceMode, LobbyVoicePeerState, RtcIceCandidate, RtcSessionDescription } from './protocol';
/** Default mesh cap — keep in sync with server LOBBY_VOICE_PEER_CAP (roadmap 3.4). */
export declare const DEFAULT_VOICE_PEER_CAP = 6;
export type VoicePosition = {
    x: number;
    y: number;
    z: number;
};
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
    /** Peers we created an offer toward (vs inbound-only). */
    private readonly offerInitiated;
    private active;
    private mode;
    private micMuted;
    private selfUserId;
    private friendIds;
    private readonly listeners;
    private disposed;
    private peerCap;
    private getPosition;
    private lastMeshRefreshMs;
    constructor(signaling: VoiceSignaling);
    onStateChange(listener: VoiceChatListener): () => boolean;
    setContext(selfUserId: string, friendUserIds: string[]): void;
    /** Optional world positions for nearest-N mesh selection. */
    setPositionProvider(fn: (userId: string) => VoicePosition | null | undefined): void;
    setPeerCap(cap: number): void;
    getState(): VoiceChatState;
    /**
     * Re-evaluate nearest peers (e.g. after movement). Throttled to ~2Hz by default.
     */
    refreshMesh(force?: boolean): void;
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
    private nearestEligiblePeerIds;
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