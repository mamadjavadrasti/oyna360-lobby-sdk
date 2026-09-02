import { io, Socket } from 'socket.io-client';
import type {
  LobbyClientMessage,
  LobbyEmoteKind,
  LobbyMoveMessage,
  LobbyPlayerState,
  LobbyServerMessage,
  LobbyVoiceMode,
  LobbyVoicePeerState,
  RtcIceCandidate,
  RtcSessionDescription,
} from './protocol';

export type NetworkClientHandlers = {
  onWelcome?: (
    self: LobbyPlayerState,
    players: LobbyPlayerState[],
    meta?: { friendUserIds?: string[]; voicePeers?: LobbyVoicePeerState[] },
  ) => void;
  onPlayerJoined?: (player: LobbyPlayerState) => void;
  onPlayerLeft?: (payload: { userId: string; username?: string; displayName?: string }) => void;
  onPlayerMoved?: (payload: {
    userId: string;
    position: LobbyPlayerState['position'];
    rotationY: number;
    animation: LobbyPlayerState['animation'];
    seq: number;
    serverTime: number;
  }) => void;
  onPlayerEmote?: (userId: string, emote: LobbyEmoteKind) => void;
  onChat?: (payload: { userId: string; username?: string; displayName: string; text: string; at: number }) => void;
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
        this.handlers.onWelcome?.(msg.self, msg.players, {
          friendUserIds: msg.friendUserIds,
          voicePeers: msg.voicePeers,
        });
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
      case 'lobby:voice:state':
        this.handlers.onVoiceState?.(msg.peers, msg.friendUserIds);
        break;
      case 'lobby:voice:joined':
        this.handlers.onVoiceJoined?.(msg.peer);
        break;
      case 'lobby:voice:left':
        this.handlers.onVoiceLeft?.(msg.userId);
        break;
      case 'lobby:voice:mute':
        this.handlers.onVoiceMute?.(msg.userId, msg.muted);
        break;
      case 'lobby:voice:offer':
        this.handlers.onVoiceOffer?.(msg.fromUserId, msg.sdp);
        break;
      case 'lobby:voice:answer':
        this.handlers.onVoiceAnswer?.(msg.fromUserId, msg.sdp);
        break;
      case 'lobby:voice:ice':
        this.handlers.onVoiceIce?.(msg.fromUserId, msg.candidate);
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

  sendVoiceJoin(mode: LobbyVoiceMode) {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:voice:join', mode } satisfies LobbyClientMessage);
  }

  sendVoiceLeave() {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:voice:leave' } satisfies LobbyClientMessage);
  }

  sendVoiceMute(muted: boolean) {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:voice:mute', muted } satisfies LobbyClientMessage);
  }

  sendVoiceOffer(toUserId: string, sdp: RtcSessionDescription) {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:voice:offer', toUserId, sdp } satisfies LobbyClientMessage);
  }

  sendVoiceAnswer(toUserId: string, sdp: RtcSessionDescription) {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:voice:answer', toUserId, sdp } satisfies LobbyClientMessage);
  }

  sendVoiceIce(toUserId: string, candidate: RtcIceCandidate) {
    if (!this.socket?.connected) return;
    this.socket.emit('message', { type: 'lobby:voice:ice', toUserId, candidate } satisfies LobbyClientMessage);
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
