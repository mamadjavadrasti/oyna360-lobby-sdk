const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];
/** Default mesh cap — keep in sync with server LOBBY_VOICE_PEER_CAP (roadmap 3.4). */
export const DEFAULT_VOICE_PEER_CAP = 6;
export class LobbyVoiceChat {
    signaling;
    localStream = null;
    peers = new Map();
    remoteAudio = new Map();
    voicePeers = new Map();
    /** Peers we created an offer toward (vs inbound-only). */
    offerInitiated = new Set();
    active = false;
    mode = 'friends';
    micMuted = false;
    selfUserId = '';
    friendIds = new Set();
    listeners = new Set();
    disposed = false;
    peerCap = DEFAULT_VOICE_PEER_CAP;
    getPosition = null;
    lastMeshRefreshMs = 0;
    iceServers = ICE_SERVERS;
    enabling = null;
    generation = 0;
    pendingIce = new Map();
    constructor(signaling) {
        this.signaling = signaling;
    }
    onStateChange(listener) {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }
    setContext(selfUserId, friendUserIds) {
        this.selfUserId = selfUserId;
        this.friendIds = new Set(friendUserIds);
    }
    /** Optional world positions for nearest-N mesh selection. */
    setPositionProvider(fn) {
        this.getPosition = fn;
    }
    setPeerCap(cap) {
        this.peerCap = Math.max(1, Math.floor(cap));
    }
    setIceServers(servers) { this.iceServers = servers; }
    /** Keep local consent/stream while a temporary transport reconnects. */
    handleTransportDisconnected() {
        this.teardownPeers();
        this.voicePeers.clear();
        this.pendingIce.clear();
        this.emitState();
    }
    getState() {
        return this.snapshot();
    }
    /**
     * Re-evaluate nearest peers (e.g. after movement). Throttled to ~2Hz by default.
     */
    refreshMesh(force = false) {
        if (!this.active || this.disposed)
            return;
        const now = performance.now();
        if (!force && now - this.lastMeshRefreshMs < 500)
            return;
        this.lastMeshRefreshMs = now;
        void this.syncPeerConnections(true).catch((error) => console.warn('[lobby-sdk] voice negotiation failed', error));
    }
    async enable(mode) {
        if (this.disposed || this.active)
            return;
        if (this.enabling)
            return this.enabling;
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
                for (const track of stream.getTracks())
                    track.stop();
                return;
            }
            this.localStream = stream;
            this.applyMicTrackState();
            this.active = true;
            this.emitState();
            this.signaling.sendJoin(mode);
        })();
        this.enabling = pending;
        try {
            await pending;
        }
        finally {
            if (this.enabling === pending)
                this.enabling = null;
        }
    }
    async disable() {
        ++this.generation;
        if (!this.active)
            return;
        this.signaling.sendLeave();
        this.teardownPeers();
        this.stopLocalStream();
        this.active = false;
        this.voicePeers.clear();
        this.pendingIce.clear();
        this.emitState();
    }
    async setMode(mode) {
        if (!this.active) {
            this.mode = mode;
            this.emitState();
            return;
        }
        if (mode === this.mode)
            return;
        await this.disable();
        await this.enable(mode);
    }
    setMicMuted(muted) {
        this.micMuted = muted;
        this.applyMicTrackState();
        if (this.active)
            this.signaling.sendMute(muted);
        this.emitState();
    }
    toggleMicMuted() {
        this.setMicMuted(!this.micMuted);
    }
    handleVoiceState(peers, friendUserIds) {
        this.friendIds = new Set(friendUserIds);
        this.voicePeers.clear();
        for (const peer of peers) {
            if (peer.userId === this.selfUserId)
                continue;
            this.voicePeers.set(peer.userId, peer);
        }
        if (!this.active)
            return;
        void this.syncPeerConnections(true).catch((error) => console.warn('[lobby-sdk] voice negotiation failed', error));
        this.emitState();
    }
    handleVoiceJoined(peer) {
        if (peer.userId === this.selfUserId)
            return;
        this.voicePeers.set(peer.userId, peer);
        if (!this.active)
            return;
        void this.syncPeerConnections(true).catch((error) => console.warn('[lobby-sdk] voice negotiation failed', error));
        this.emitState();
    }
    handleVoiceLeft(userId) {
        this.voicePeers.delete(userId);
        this.closePeer(userId);
        this.emitState();
    }
    handleVoiceMute(userId, muted) {
        const peer = this.voicePeers.get(userId);
        if (!peer)
            return;
        peer.muted = muted;
        const audio = this.remoteAudio.get(userId);
        if (audio)
            audio.muted = muted;
    }
    async handleOffer(fromUserId, sdp) {
        if (!this.active || fromUserId === this.selfUserId)
            return;
        const peerState = this.voicePeers.get(fromUserId);
        // Mode gate only — accept inbound offers outside nearest-N (asymmetric mesh).
        if (!peerState || !this.canConnectTo(peerState))
            return;
        const pc = await this.ensurePeer(fromUserId);
        await pc.setRemoteDescription(sdp);
        await this.flushIce(fromUserId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
            this.signaling.sendAnswer(fromUserId, pc.localDescription);
        }
    }
    async handleAnswer(fromUserId, sdp) {
        const pc = this.peers.get(fromUserId);
        if (!pc)
            return;
        await pc.setRemoteDescription(sdp);
        await this.flushIce(fromUserId, pc);
    }
    async handleIce(fromUserId, candidate) {
        const pc = this.peers.get(fromUserId);
        if (!candidate.candidate || !this.active || !this.voicePeers.has(fromUserId))
            return;
        if (!pc?.remoteDescription) {
            const queued = this.pendingIce.get(fromUserId) ?? [];
            if (queued.length < 32)
                queued.push(candidate);
            this.pendingIce.set(fromUserId, queued);
            return;
        }
        try {
            await pc.addIceCandidate(candidate);
        }
        catch {
            // Ignore late ICE after close.
        }
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        void this.disable();
        this.listeners.clear();
    }
    async syncPeerConnections(asOfferer) {
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
            if (!meshIds.has(peer.userId))
                continue;
            if (asOfferer && this.selfUserId.localeCompare(peer.userId) < 0 && !this.peers.has(peer.userId)) {
                await this.createOffer(peer.userId);
            }
        }
    }
    canConnectTo(peer) {
        if (peer.userId === this.selfUserId)
            return false;
        const iAllow = this.mode === 'all' || this.friendIds.has(peer.userId);
        const theyAllow = peer.mode === 'all' || this.friendIds.has(peer.userId);
        return iAllow && theyAllow;
    }
    nearestEligiblePeerIds() {
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
    async createOffer(userId) {
        this.offerInitiated.add(userId);
        const pc = await this.ensurePeer(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
            this.signaling.sendOffer(userId, pc.localDescription);
        }
    }
    async ensurePeer(userId) {
        const existing = this.peers.get(userId);
        if (existing)
            return existing;
        const pc = new RTCPeerConnection({ iceServers: this.iceServers });
        this.peers.set(userId, pc);
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signaling.sendIce(userId, event.candidate.toJSON());
            }
        };
        pc.ontrack = (event) => {
            const [stream] = event.streams;
            if (!stream)
                return;
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
            if (peer)
                audio.muted = peer.muted;
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
    closePeer(userId) {
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
    async flushIce(userId, pc) {
        const queued = this.pendingIce.get(userId) ?? [];
        this.pendingIce.delete(userId);
        for (const candidate of queued) {
            try {
                await pc.addIceCandidate(candidate);
            }
            catch { /* Late candidates may belong to an older connection. */ }
        }
    }
    teardownPeers() {
        for (const userId of [...this.peers.keys()])
            this.closePeer(userId);
    }
    stopLocalStream() {
        for (const track of this.localStream?.getTracks() ?? [])
            track.stop();
        this.localStream = null;
    }
    applyMicTrackState() {
        for (const track of this.localStream?.getAudioTracks() ?? []) {
            track.enabled = !this.micMuted;
        }
    }
    snapshot() {
        return {
            active: this.active,
            mode: this.mode,
            muted: this.micMuted,
            peerCount: this.peers.size,
        };
    }
    emitState() {
        const state = this.snapshot();
        for (const listener of this.listeners)
            listener(state);
    }
}
//# sourceMappingURL=voice-chat.js.map