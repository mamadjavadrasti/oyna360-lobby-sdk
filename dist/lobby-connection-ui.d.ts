import type { PlatformLobby } from './platform-lobby';
import { type LobbyUiMessages } from './lobby-ui-i18n';
/**
 * Full-screen connection status overlay.
 * Shows when disconnected / reconnecting / reconnect failed.
 */
export declare function attachLobbyConnectionUi(lobby: PlatformLobby, messages?: Partial<LobbyUiMessages>): () => void;
//# sourceMappingURL=lobby-connection-ui.d.ts.map