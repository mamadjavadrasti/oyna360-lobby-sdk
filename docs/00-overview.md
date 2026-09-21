# نمای کلی — `@oyna360/lobby-sdk`

برای بازی‌سازی که می‌خواهد **لابی ۳D مشترک** قبل از مسابقه داشته باشد.

---

## مسئولیت‌ها

| این SDK | پلتفرم / game-sdk | بازی شما |
|---------|-------------------|----------|
| رندر لابی، آواتار، حرکت | هویت، سشن، `platform:init` / Direct Auth | تم، پورتال، قوانین شروع مسابقه |
| WebSocket `/lobby` | ساخت اتاق و اعتبار سشن | سرور گیم‌پلی بعد از `destroy()` |
| چت / voice لابی | فلگ‌ها و moderation سمت سرور | UI اختصاصی مسابقه |

**لاگین و Authorize کار lobby-sdk نیست.** همیشه Context را از game-sdk یا parent پلتفرم بگیرید.

---

## وابستگی‌ها

- peer: `@babylonjs/core` ^7
- همراه پکیج: `socket.io-client`, `@babylonjs/loaders`
- پروتکل پیام‌ها داخل `dist` bundle شده

---

## جریان کلی

```text
PlatformSDK.init()  →  SdkInitPayload (user, session, avatar, lobby)
        ↓
PlatformLobby.create({ platformInit, wsUrl, roomId })
        ↓
بازیکن در لابی حرکت / چت می‌کند
        ↓
پورتال یا شمارش اتاق → callback شما
        ↓
lobby.destroy() → گیم‌پلی خودتان
```

---

## چه چیزهایی export می‌شود؟

علاوه بر `PlatformLobby`: کارخانه آواتار، انیماتور، دوربین، collider، pluginهای نمونه، ابزار diag — برای سفارشی‌سازی پیشرفته. برای اکثر بازی‌ها همان `PlatformLobby` کافی است.

بعدی: [01-connect.md](./01-connect.md) · نصب: [02-install.md](./02-install.md)
