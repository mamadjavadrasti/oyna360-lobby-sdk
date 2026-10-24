import type {
  LobbyVoiceMode,
  LobbyVoicePeerState,
  RtcIceCandidate,
  RtcSessionDescription,
} from './protocol.js';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Default mesh cap — keep in sync with server LOBBY_VOICE_PEER_CAP (roadmap 3.4). */
export const DEFAULT_VOICE_PEER_CAP = 6;

export type VoicePosition = { x: number; y: number; z: number };

export type VoiceSignaling = {
  validateJoin?(mode: LobbyVoiceMode): void;
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

export class LobbyVoiceChat {
  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly remoteAudio = new Map<string, HTMLAudioElement>();
  private readonly voicePeers = new Map<string, LobbyVoicePeerState>();
  /** Peers we created an offer toward (vs inbound-only). */
  private readonly offerInitiated = new Set<string>();
  private active = false;
  private mode: LobbyVoiceMode = 'friends';
  private micMuted = false;
  private selfUserId = '';
  private friendIds = new Set<string>();
  private readonly listeners = new Set<VoiceChatListener>();
  private disposed = false;
  private peerCap = DEFAULT_VOICE_PEER_CAP;
  private getPosition: ((userId: string) => VoicePosition | null | undefined) | null = null;
  private lastMeshRefreshMs = 0;
  private iceServers: RTCIceServer[] = ICE_SERVERS;
  private enabling: Promise<void> | null = null;
  private generation = 0;
  private readonly pendingIce = new Map<string, RtcIceCandidate[]>();

  constructor(private readonly signaling: VoiceSignaling) {}

  onStateChange(listener: VoiceChatListener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  setContext(selfUserId: string, friendUserIds: string[]) {
    this.selfUserId = selfUserId;
    this.friendIds = new Set(friendUserIds);
  }

  /** Optional world positions for nearest-N mesh selection. */
  setPositionProvider(fn: (userId: string) => VoicePosition | null | undefined) {
    this.getPosition = fn;
  }

  setPeerCap(cap: number) {
    this.peerCap = Math.max(1, Math.floor(cap));
  }
  setIceServers(servers: RTCIceServer[]) { this.iceServers = servers; }

  /** Keep local consent/stream while a temporary transport reconnects. */
  handleTransportDisconnected() {
    this.teardownPeers();
    this.voicePeers.clear();
    this.pendingIce.clear();
    this.emitState();
  }

  getState(): VoiceChatState {
    return this.snapshot();
  }

  /**
   * Re-evaluate nearest peers (e.g. after movement). Throttled to ~2Hz by default.
   */
  refreshMesh(force = false) {
    if (!this.active || this.disposed) return;
    const now = performance.now();
    if (!force && now - this.lastMeshRefreshMs < 500) return;
    this.lastMeshRefreshMs = now;
    void this.syncPeerConnections(true).catch((error) => console.warn('[lobby-sdk] voice negotiation failed', error));
  }

  async enable(mode: LobbyVoiceMode): Promise<void> {
    if (this.disposed || this.active) return;
    if (this.enabling) return this.enabling;
    this.signaling.validateJoin?.(mode);
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone is not supported in this browser');
    }

    const generation = ++this.generation;
    this.mode = mode;
    const pending = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (this.disposed || generation !== this.generation) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      this.localStream = stream;
      this.applyMicTrackState();
      this.active = true;
      this.emitState();
      this.signaling.sendJoin(mode);
    })();
    this.enabling = pending;
    try { await pending; } finally { if (this.enabling === pending) this.enabling = null; }
  }

  async disable(): Promise<void> {
    ++this.generation;
    if (!this.active) return;
    this.signaling.sendLeave();
    this.teardownPeers();
    this.stopLocalStream();
    this.active = false;
    this.voicePeers.clear();
    this.pendingIce.clear();
    this.emitState();
  }

  async setMode(mode: LobbyVoiceMode): Promise<void> {
    if (!this.active) {
      this.mode = mode;
      this.emitState();
      return;
    }
    if (mode === this.mode) return;
    await this.disable();
    await this.enable(mode);
  }

  setMicMuted(muted: boolean) {
    this.micMuted = muted;
    this.applyMicTrackState();
    if (this.active) this.signaling.sendMute(muted);
    this.emitState();
  }

  toggleMicMuted() {
    this.setMicMuted(!this.micMuted);
  }

  handleVoiceState(peers: LobbyVoicePeerState[], friendUserIds: string[]) {
    this.friendIds = new Set(friendUserIds);
    this.voicePeers.clear();
    for (const peer of peers) {
      if (peer.userId === this.selfUserId) continue;
      this.voicePeers.set(peer.userId, peer);
    }
    if (!this.active) return;
    void this.syncPeerConnections(true).catch((error) => console.warn('[lobby-sdk] voice negotiation failed', error));
    this.emitState();
  }

  handleVoiceJoined(peer: LobbyVoicePeerState) {
    if (peer.userId === this.selfUserId) return;
    this.voicePeers.set(peer.userId, peer);
    if (!this.active) return;
    void this.syncPeerConnections(true).catch((error) => console.warn('[lobby-sdk] voice negotiation failed', error));
    this.emitState();
  }

  handleVoiceLeft(userId: string) {
    this.voicePeers.delete(userId);
    this.closePeer(userId);
    this.emitState();
  }

  handleVoiceMute(userId: string, muted: boolean) {
    const peer = this.voicePeers.get(userId);
    if (!peer) return;
    peer.muted = muted;
    const audio = this.remoteAudio.get(userId);
    if (audio) audio.muted = muted;
  }

  async handleOffer(fromUserId: string, sdp: RtcSessionDescription) {
    if (!this.active || fromUserId === this.selfUserId) return;
    const peerState = this.voicePeers.get(fromUserId);
    // Mode gate only — accept inbound offers outside nearest-N (asymmetric mesh).
    if (!peerState || !this.canConnectTo(peerState)) return;

    const pc = await this.ensurePeer(fromUserId);
    await pc.setRemoteDescription(sdp as RTCSessionDescriptionInit);
    await this.flushIce(fromUserId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (pc.localDescription) {
      this.signaling.sendAnswer(fromUserId, pc.localDescription);
    }
  }

  async handleAnswer(fromUserId: string, sdp: RtcSessionDescription) {
    const pc = this.peers.get(fromUserId);
    if (!pc) return;
    await pc.setRemoteDescription(sdp as RTCSessionDescriptionInit);
    await this.flushIce(fromUserId, pc);
  }

  async handleIce(fromUserId: string, candidate: RtcIceCandidate) {
    const pc = this.peers.get(fromUserId);
    if (!candidate.candidate || !this.active || !this.voicePeers.has(fromUserId)) return;
    if (!pc?.remoteDescription) {
      const queued = this.pendingIce.get(fromUserId) ?? [];
      if (queued.length < 32) queued.push(candidate);
      this.pendingIce.set(fromUserId, queued);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // Ignore late ICE after close.
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    void this.disable();
    this.listeners.clear();
  }

  private async syncPeerConnections(asOfferer: boolean) {
    const meshIds = this.nearestEligiblePeerIds();
    for (const userId of [...this.peers.keys()]) {
      const peer = this.voicePeers.get(userId);
      if (!peer || !this.canConnectTo(peer)) {
        this.closePeer(userId);
        continue;
      }
      // Drop outbound links that fell outside nearest-N; keep inbound replies.
      if (!meshIds.has(userId) && this.offerInitiated.has(userId)) {
        this.closePeer(userId);
      }
    }
    for (const peer of this.voicePeers.values()) {
      if (!meshIds.has(peer.userId)) continue;
      if (asOfferer && this.selfUserId.localeCompare(peer.userId) < 0 && !this.peers.has(peer.userId)) {
        await this.createOffer(peer.userId);
      }
    }
  }

  private canConnectTo(peer: LobbyVoicePeerState): boolean {
    if (peer.userId === this.selfUserId) return false;
    const iAllow = this.mode === 'all' || this.friendIds.has(peer.userId);
    const theyAllow = peer.mode === 'all' || this.friendIds.has(peer.userId);
    return iAllow && theyAllow;
  }

  private nearestEligiblePeerIds(): Set<string> {
    const eligible = [...this.voicePeers.values()].filter((p) => this.canConnectTo(p));
    if (eligible.length <= this.peerCap) {
      return new Set(eligible.map((p) => p.userId));
    }

    const selfPos = this.getPosition?.(this.selfUserId) ?? null;
    const ranked = eligible.map((peer) => {
      const pos = this.getPosition?.(peer.userId);
      let dist = Number.POSITIVE_INFINITY;
      if (selfPos && pos) {
        const dx = pos.x - selfPos.x;
        const dz = pos.z - selfPos.z;
        dist = Math.hypot(dx, dz);
      }
      return { userId: peer.userId, dist };
    });

    ranked.sort((a, b) => a.dist - b.dist || a.userId.localeCompare(b.userId));
    return new Set(ranked.slice(0, this.peerCap).map((r) => r.userId));
  }

  private async createOffer(userId: string) {
    this.offerInitiated.add(userId);
    const pc = await this.ensurePeer(userId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (pc.localDescription) {
      this.signaling.sendOffer(userId, pc.localDescription);
    }
  }

  private async ensurePeer(userId: string): Promise<RTCPeerConnection> {
    const existing = this.peers.get(userId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peers.set(userId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIce(userId, event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      let audio = this.remoteAudio.get(userId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.style.display = 'none';
        document.body.append(audio);
        this.remoteAudio.set(userId, audio);
      }
      audio.srcObject = stream;
      const peer = this.voicePeers.get(userId);
      if (peer) audio.muted = peer.muted;
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(userId);
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }
    this.emitState();
    return pc;
  }

  private closePeer(userId: string) {
    this.peers.get(userId)?.close();
    this.peers.delete(userId);
    this.offerInitiated.delete(userId);
    const audio = this.remoteAudio.get(userId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
    }
    this.remoteAudio.delete(userId);
    this.pendingIce.delete(userId);
    this.emitState();
  }

  private async flushIce(userId: string, pc: RTCPeerConnection) {
    const queued = this.pendingIce.get(userId) ?? [];
    this.pendingIce.delete(userId);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate); } catch { /* Late candidates may belong to an older connection. */ }
    }
  }

  private teardownPeers() {
    for (const userId of [...this.peers.keys()]) this.closePeer(userId);
  }

  private stopLocalStream() {
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;
  }

  private applyMicTrackState() {
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !this.micMuted;
    }
  }

  private snapshot(): VoiceChatState {
    return {
      active: this.active,
      mode: this.mode,
      muted: this.micMuted,
      peerCount: this.peers.size,
    };
  }

  private emitState() {
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state);
  }
}
