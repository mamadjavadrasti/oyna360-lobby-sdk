import { io, Socket } from 'socket.io-client';
import type {
  LobbyClientMessage,
  LobbyEmoteKind,
  LobbyMoveMessage,
  LobbyPlayerState,
  LobbyServerMessage,
} from './protocol';

export type NetworkClientHandlers = {
  onWelcome?: (self: LobbyPlayerState, players: LobbyPlayerState[]) => void;
  onPlayerJoined?: (player: LobbyPlayerState) => void;
  onPlayerLeft?: (userId: string) => void;
  onPlayerMoved?: (payload: {
    userId: string;
    position: LobbyPlayerState['position'];
    rotationY: number;
    animation: LobbyPlayerState['animation'];
    seq: number;
    serverTime: number;
  }) => void;
  onPlayerEmote?: (userId: string, emote: LobbyEmoteKind) => void;
  onChat?: (payload: { userId: string; displayName: string; text: string; at: number }) => void;
  onError?: (code: string, message: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

export class NetworkClient {
  private socket: Socket | null = null;
  private moveSeq = 0;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 8;

  constructor(
    private readonly wsUrl: string,
    private readonly roomId: string,
    private readonly sessionToken: string,
    private readonly handlers: NetworkClientHandlers = {},
  ) {}

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

    this.socket.on('message', (msg: LobbyServerMessage) => this.handleServerMessage(msg));

    this.socket.io.on('reconnect_attempt', () => {
      this.reconnectAttempts += 1;
    });
  }

  private handleServerMessage(msg: LobbyServerMessage) {
    switch (msg.type) {
      case 'lobby:welcome':
        this.handlers.onWelcome?.(msg.self, msg.players);
        break;
      case 'lobby:player:joined':
        this.handlers.onPlayerJoined?.(msg.player);
        break;
      case 'lobby:player:left':
        this.handlers.onPlayerLeft?.(msg.userId);
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

  sendMove(payload: Omit<LobbyMoveMessage, 'type' | 'seq'>) {
    if (!this.socket?.connected) return;
    this.moveSeq += 1;
    const msg: LobbyClientMessage = {
      type: 'lobby:move',
      ...payload,
      seq: this.moveSeq,
    };
    this.socket.emit('message', msg);
  }

  sendEmote(emote: LobbyEmoteKind) {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:emote', emote } satisfies LobbyClientMessage);
  }

  sendChat(text: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:chat', text } satisfies LobbyClientMessage);
  }

  ping() {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:ping' } satisfies LobbyClientMessage);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }
}
