const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];
export class LobbyVoiceChat {
    signaling;
    localStream = null;
    peers = new Map();
    remoteAudio = new Map();
    voicePeers = new Map();
    active = false;
    mode = 'friends';
    micMuted = false;
    selfUserId = '';
    friendIds = new Set();
    listeners = new Set();
    disposed = false;
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
    getState() {
        return this.snapshot();
    }
    async enable(mode) {
        if (this.disposed || this.active)
            return;
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Microphone is not supported in this browser');
        }
        this.mode = mode;
        this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
            video: false,
        });
        this.applyMicTrackState();
        this.active = true;
        this.emitState();
        this.signaling.sendJoin(mode);
    }
    async disable() {
        if (!this.active)
            return;
        this.signaling.sendLeave();
        this.teardownPeers();
        this.stopLocalStream();
        this.active = false;
        this.voicePeers.clear();
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
        void this.syncPeerConnections(true);
        this.emitState();
    }
    handleVoiceJoined(peer) {
        if (peer.userId === this.selfUserId)
            return;
        this.voicePeers.set(peer.userId, peer);
        if (!this.active)
            return;
        // Existing participants wait for offers from the joiner.
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
        if (!peerState || !this.canConnectTo(peerState))
            return;
        const pc = await this.ensurePeer(fromUserId);
        await pc.setRemoteDescription(sdp);
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
    }
    async handleIce(fromUserId, candidate) {
        const pc = this.peers.get(fromUserId);
        if (!pc || !candidate.candidate)
            return;
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
        for (const peer of this.voicePeers.values()) {
            if (!this.canConnectTo(peer)) {
                this.closePeer(peer.userId);
                continue;
            }
            if (asOfferer && !this.peers.has(peer.userId)) {
                await this.createOffer(peer.userId);
            }
        }
    }
    canConnectTo(peer) {
        if (peer.userId === this.selfUserId)
            return false;
        const iAllow = this.mode === 'all' || this.friendIds.has(peer.userId);
        const theyAllow = peer.mode === 'all' || this.friendIds.has(this.selfUserId);
        return iAllow && theyAllow;
    }
    async createOffer(userId) {
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
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
        return pc;
    }
    closePeer(userId) {
        this.peers.get(userId)?.close();
        this.peers.delete(userId);
        const audio = this.remoteAudio.get(userId);
        if (audio) {
            audio.srcObject = null;
            audio.remove();
        }
        this.remoteAudio.delete(userId);
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