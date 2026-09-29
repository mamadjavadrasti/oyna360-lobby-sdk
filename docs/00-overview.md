# نمای کلی — `@oyna360/lobby-sdk` (Core)

Core لابی oyna360: ارتباط شبکه و state — **بدون Babylon**.

برای صحنه ۳D و `PlatformLobby` → [`@oyna360/lobby-babylon`](https://www.npmjs.com/package/@oyna360/lobby-babylon).

---

## مسئولیت‌ها

| این پکیج (Core) | lobby-babylon | پلتفرم / game-sdk | بازی شما |
|-----------------|---------------|-------------------|----------|
| LobbyClient، AvatarState، protocol | رندر، AvatarFactory، صحنه | هویت، سشن، `platform:init` | تم، پورتال، شروع مسابقه |
| WebSocket `/lobby` | دوربین، برخورد، UI لابی | اتاق و اعتبار سشن | گیم‌پلی بعد از `destroy()` |

**لاگین کار lobby-sdk نیست.** Context را از game-sdk بگیرید.

---

## وابستگی‌ها

- `socket.io-client`
- **بدون** `@babylonjs/core` / `@babylonjs/loaders`
- پروتکل داخل `dist` bundle شده

---

## جریان کلی

```text
PlatformSDK.init()  →  SdkInitPayload
        ↓
LobbyClient.create / connect   ← فقط Core
   یا
PlatformLobby.create (…)       ← از lobby-babylon (روی LobbyClient)
        ↓
بازیکن در لابی
        ↓
lobby.destroy() → گیم‌پلی
```

---

## چه چیزهایی export می‌شود؟

`LobbyClient`, `LobbyAvatarController`, `NetworkClient`, `PlatformBridge`, protocol helpers، locomotion ریاضی (بدون mesh)، pluginهای Core، …

`PlatformLobby` و `AvatarFactory` اینجا نیستند → `lobby-babylon`.

بعدی: [02-install.md](./02-install.md) · API: [04-api.md](./04-api.md)
