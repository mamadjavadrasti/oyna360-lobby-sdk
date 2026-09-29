/**
 * Lobby audio: background theme + movement SFX (Web Audio).
 * Browsers only allow playback after a user gesture inside this frame.
 */
export declare class LobbyMusic {
    private ctx;
    private master;
    private musicBus;
    private sfxBus;
    private noise;
    private step;
    private timer;
    private muted;
    private musicStarted;
    private skipAutoStart;
    private unlocking;
    private readonly onGesture;
    constructor();
    /** Call from the music button so the same click does not start then immediately mute. */
    noteUserToggled(): void;
    unlock(autoStartMusic?: boolean): Promise<void>;
    startMusic(): Promise<void>;
    setMuted(muted: boolean): void;
    /** @returns true when music is muted after the toggle */
    toggleMuted(): boolean;
    isMuted(): boolean;
    playStep(running: boolean): void;
    playJump(): void;
    playLand(impact?: number): void;
    dispose(): void;
    private ensureContext;
    private applyMusicGain;
    private tick;
    private tone;
    private thump;
    private sweep;
    private noiseBurst;
    private makeNoise;
}
//# sourceMappingURL=lobby-music.d.ts.map