import { io } from 'socket.io-client';
export class NetworkClient {
    wsUrl;
    roomId;
    sessionToken;
    handlers;
    socket = null;
    moveSeq = 0;
    reconnectAttempts = 0;
    maxReconnectAttempts = 8;
    constructor(wsUrl, roomId, sessionToken, handlers = {}) {
        this.wsUrl = wsUrl;
        this.roomId = roomId;
        this.sessionToken = sessionToken;
        this.handlers = handlers;
    }
    connect() {
        const url = this.wsUrl.replace(/\/lobby\/?$/, '');
        this.socket = io(`${url}/lobby`, {
            transports: ['websocket'],
            query: {
                sessionToken: this.sessionToken,
                roomId: this.roomId,
            },
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 8000,
        });
        this.socket.on('connect', () => {
            this.reconnectAttempts = 0;
            this.handlers.onConnected?.();
        });
        this.socket.on('disconnect', () => {
            this.handlers.onDisconnected?.();
        });
        this.socket.on('message', (msg) => this.handleServerMessage(msg));
        this.socket.io.on('reconnect_attempt', () => {
            this.reconnectAttempts += 1;
        });
    }
    handleServerMessage(msg) {
        switch (msg.type) {
            case 'lobby:welcome':
                this.handlers.onWelcome?.(msg.self, msg.players);
                break;
            case 'lobby:player:joined':
                this.handlers.onPlayerJoined?.(msg.player);
                break;
            case 'lobby:player:left':
                this.handlers.onPlayerLeft?.({
                    userId: msg.userId,
                    username: msg.username,
                    displayName: msg.displayName,
                });
                break;
            case 'lobby:player:moved':
                this.handlers.onPlayerMoved?.(msg);
                break;
            case 'lobby:player:emote':
                this.handlers.onPlayerEmote?.(msg.userId, msg.emote);
                break;
            case 'lobby:chat':
                this.handlers.onChat?.(msg);
                break;
            case 'lobby:error':
                this.handlers.onError?.(msg.code, msg.message);
                break;
            default:
                break;
        }
    }
    sendMove(payload) {
        if (!this.socket?.connected)
            return;
        this.moveSeq += 1;
        const msg = {
            type: 'lobby:move',
            ...payload,
            seq: this.moveSeq,
        };
        this.socket.emit('message', msg);
    }
    sendEmote(emote) {
        if (!this.socket?.connected)
            return;
        this.socket.emit('message', { type: 'lobby:emote', emote });
    }
    sendChat(text) {
        if (!this.socket?.connected)
            return;
        this.socket.emit('message', { type: 'lobby:chat', text });
    }
    ping() {
        if (!this.socket?.connected)
            return;
        this.socket.emit('message', { type: 'lobby:ping' });
    }
    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
    isConnected() {
        return Boolean(this.socket?.connected);
    }
}
//# sourceMappingURL=network-client.js.map