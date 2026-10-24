import { io } from 'socket.io-client';
import { LobbyVoiceChat } from './voice-chat.js';
export function requestLobbyCommunicationCredentials(parentOrigin, channel, lobbyRoomId) {
    if (window.parent === window || !parentOrigin || parentOrigin === '*')
        return Promise.reject(new Error('مبدأ دقیق پلتفرم برای ارتباطات لابی لازم است'));
    return new Promise((resolve, reject) => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const requestId = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        const finish = () => {
            clearTimeout(timer);
            window.removeEventListener('message', listener);
        };
        const listener = (event) => {
            if (event.source !== window.parent ||
                event.origin !== parentOrigin ||
                event.data?.type !== 'oyna:lobby:communications:init' ||
                event.data.requestId !== requestId)
                return;
            finish();
            const data = event.data;
            if (data.error)
                reject(new Error(data.error));
            else if (!data.token || !data.roomId || !data.baseUrl || !data.userId)
                reject(new Error('پاسخ ارتباطات لابی نامعتبر است'));
            else
                resolve(data);
        };
        const timer = setTimeout(() => {
            finish();
            reject(new Error('اتصال به ارتباطات لابی زمان‌بر شد'));
        }, 10000);
        window.addEventListener('message', listener);
        window.parent.postMessage({ type: 'oyna:lobby:communications:request', requestId, channel, lobbyRoomId }, parentOrigin);
    });
}
/** Text and live calls use dedicated sockets on the independent communications service. */
export class LobbyCommunications {
    userId;
    options;
    onChat;
    onError;
    voice;
    textSocket = null;
    voiceSocket = null;
    peers = new Map();
    seen = new Set();
    disposed = false;
    voiceGeneration = 0;
    textGeneration = 0;
    roomId = '';
    textReady = false;
    timers = new Map();
    constructor(userId, options, onChat, onError) {
        this.userId = userId;
        this.options = options;
        this.onChat = onChat;
        this.onError = onError;
        this.voice = new LobbyVoiceChat({
            validateJoin: (mode) => {
                if (mode === 'all' && !this.options.allowLobbyVoice)
                    throw new Error('تماس همگانی لابی فعال نشده است');
            },
            sendJoin: (mode) => {
                void this.connectVoice(mode === 'all' ? 'voice-lobby' : 'voice-party');
            },
            sendLeave: () => this.stopVoice(),
            sendMute: (muted) => this.voiceSocket?.emit('mute', muted),
            sendOffer: (toUserId, value) => this.voiceSocket?.emit('signal', { type: 'offer', toUserId, value }),
            sendAnswer: (toUserId, value) => this.voiceSocket?.emit('signal', { type: 'answer', toUserId, value }),
            sendIce: (toUserId, value) => this.voiceSocket?.emit('signal', { type: 'ice', toUserId, value }),
        });
        this.voice.setContext(userId, []);
        this.voice.setPeerCap(7);
    }
    setLobbyRoom(lobbyRoomId) {
        this.roomId = lobbyRoomId;
    }
    hasLobbyRoom() {
        return Boolean(this.roomId);
    }
    async startText(lobbyRoomId) {
        this.roomId = lobbyRoomId;
        const generation = ++this.textGeneration;
        this.textSocket?.disconnect();
        this.textSocket = null;
        this.textReady = false;
        try {
            const credentials = await this.credentials('text');
            if (this.disposed || generation !== this.textGeneration)
                return;
            const socket = this.socket(credentials, 'text');
            this.textSocket = socket;
            socket.on('ready', () => {
                this.textReady = true;
            });
            socket.on('disconnect', () => {
                this.textReady = false;
            });
            socket.on('text', (message) => {
                if (this.seen.has(message.requestId))
                    return;
                this.seen.add(message.requestId);
                if (this.seen.size > 200)
                    this.seen.delete(this.seen.values().next().value);
                this.onChat(message);
            });
            this.renew('text', credentials.expiresIn, () => {
                void this.startText(this.roomId);
            });
        }
        catch (error) {
            if (!this.disposed && generation === this.textGeneration)
                this.fail(error);
        }
    }
    sendText(text) {
        if (!this.textSocket?.connected || !this.textReady) {
            this.fail(new Error('کانال چت لابی هنوز متصل نیست'));
            return false;
        }
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        const requestId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        this.textSocket.emit('text', { text, requestId });
        return true; // UI echo comes from the validated server message, not a local success assumption.
    }
    async credentials(channel) {
        if (!this.roomId)
            throw new Error('ابتدا اتصال به لابی را کامل کن');
        let origin = this.options.parentOrigin;
        if (!origin && document.referrer)
            origin = new URL(document.referrer).origin;
        const credentials = this.options.getCredentials
            ? await this.options.getCredentials(channel, this.roomId)
            : await requestLobbyCommunicationCredentials(origin || '', channel, this.roomId);
        if (credentials.userId !== this.userId)
            throw new Error('کاربر کانال با کاربر لابی یکسان نیست');
        return credentials;
    }
    socket(credentials, channel) {
        const socket = io(`${new URL(credentials.baseUrl).origin}/communications-live`, {
            transports: ['websocket'],
            forceNew: true,
            reconnectionAttempts: 5,
            auth: { token: credentials.token, roomId: credentials.roomId, channel },
        });
        socket.on('connect_error', (error) => this.fail(error, channel));
        socket.on('channel:error', ({ message }) => this.fail(new Error(message), channel));
        return socket;
    }
    async connectVoice(channel) {
        const generation = ++this.voiceGeneration;
        try {
            if (channel === 'voice-lobby' && !this.options.allowLobbyVoice)
                throw new Error('تماس همگانی لابی فعال نشده است');
            const credentials = await this.credentials(channel);
            if (this.disposed || generation !== this.voiceGeneration || !this.voice.getState().active)
                return;
            this.voiceSocket?.disconnect();
            this.voice.handleTransportDisconnected();
            const socket = this.socket(credentials, channel);
            this.voiceSocket = socket;
            const sync = () => this.voice.setContext(this.userId, [...this.peers.keys()]);
            socket.on('ready', ({ peers, iceServers }) => {
                this.peers.clear();
                for (const peer of peers)
                    this.peers.set(peer.userId, peer);
                this.voice.setIceServers(iceServers);
                sync();
                this.voice.handleVoiceState(peers, [...this.peers.keys()]);
                socket.emit('mute', this.voice.getState().muted);
            });
            socket.on('peer:joined', (peer) => {
                this.peers.set(peer.userId, peer);
                sync();
                this.voice.handleVoiceJoined(peer);
            });
            socket.on('peer:left', ({ userId }) => {
                this.peers.delete(userId);
                sync();
                this.voice.handleVoiceLeft(userId);
            });
            socket.on('peer:mute', ({ userId, muted }) => this.voice.handleVoiceMute(userId, muted));
            socket.on('signal', (message) => {
                const pending = message.type === 'offer'
                    ? this.voice.handleOffer(message.fromUserId, message.value)
                    : message.type === 'answer'
                        ? this.voice.handleAnswer(message.fromUserId, message.value)
                        : this.voice.handleIce(message.fromUserId, message.value);
                void pending.catch((error) => this.fail(error, channel));
            });
            socket.on('disconnect', (reason) => {
                if (generation !== this.voiceGeneration)
                    return;
                this.voice.handleTransportDisconnected();
                if (reason === 'io server disconnect')
                    void this.voice.disable();
            });
            socket.io.on('reconnect_failed', () => {
                void this.voice.disable();
                this.fail(new Error('تماس قطع شد؛ دوباره وصل شو'), channel);
            });
            this.renew(channel, credentials.expiresIn, () => {
                void this.connectVoice(channel);
            });
        }
        catch (error) {
            if (!this.disposed && generation === this.voiceGeneration) {
                void this.voice.disable();
                this.fail(error, channel);
            }
        }
    }
    renew(channel, seconds, callback) {
        clearTimeout(this.timers.get(channel));
        this.timers.set(channel, setTimeout(callback, Math.max(30, (Number.isFinite(seconds) ? seconds : 900) - 30) * 1000));
    }
    stopVoice() {
        ++this.voiceGeneration;
        this.voiceSocket?.disconnect();
        this.voiceSocket = null;
        this.peers.clear();
        for (const channel of ['voice-party', 'voice-lobby']) {
            clearTimeout(this.timers.get(channel));
            this.timers.delete(channel);
        }
    }
    fail(error, channel = 'text') {
        if (!this.disposed)
            this.onError(error instanceof Error ? error : new Error(String(error)), channel);
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        ++this.textGeneration;
        this.voice.dispose();
        this.stopVoice();
        this.textSocket?.disconnect();
        this.textSocket = null;
        for (const timer of this.timers.values())
            clearTimeout(timer);
        this.timers.clear();
    }
}
//# sourceMappingURL=lobby-communications.js.map