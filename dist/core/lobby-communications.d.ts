import { LobbyVoiceChat } from './voice-chat.js';
export type LobbyCommunicationChannel = 'text' | 'voice-party' | 'voice-lobby';
export type LobbyCommunicationCredentials = {
    baseUrl: string;
    roomId: string;
    userId: string;
    token: string;
    expiresIn: number;
};
export type LobbyCommunicationsOptions = {
    /** Exact platform origin. Defaults to document.referrer's origin inside the platform iframe. */
    parentOrigin?: string;
    /** Whole-lobby calls are opt-in. The default call uses the explicitly selected friends room. */
    allowLobbyVoice?: boolean;
    /** Direct development / custom host: return only a scoped token for this channel's room. */
    getCredentials?: (channel: LobbyCommunicationChannel, lobbyRoomId: string) => Promise<LobbyCommunicationCredentials>;
};
export type LobbyChatMessage = {
    userId: string;
    username?: string;
    displayName: string;
    text: string;
    at: number;
};
export declare function requestLobbyCommunicationCredentials(parentOrigin: string, channel: LobbyCommunicationChannel, lobbyRoomId: string): Promise<LobbyCommunicationCredentials>;
/** Text and live calls use dedicated sockets on the independent communications service. */
export declare class LobbyCommunications {
    private readonly userId;
    private readonly options;
    private readonly onChat;
    private readonly onError;
    readonly voice: LobbyVoiceChat;
    private textSocket;
    private voiceSocket;
    private readonly peers;
    private readonly seen;
    private disposed;
    private voiceGeneration;
    private textGeneration;
    private roomId;
    private textReady;
    private readonly timers;
    constructor(userId: string, options: LobbyCommunicationsOptions, onChat: (message: LobbyChatMessage) => void, onError: (error: Error, channel?: LobbyCommunicationChannel) => void);
    setLobbyRoom(lobbyRoomId: string): void;
    hasLobbyRoom(): boolean;
    startText(lobbyRoomId: string): Promise<void>;
    sendText(text: string): boolean;
    private credentials;
    private socket;
    private connectVoice;
    private renew;
    private stopVoice;
    private fail;
    dispose(): void;
}
//# sourceMappingURL=lobby-communications.d.ts.map