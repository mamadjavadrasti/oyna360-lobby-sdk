# وصل کردن لابی به بازی

## قرارداد

| پلتفرم می‌دهد | شما می‌سازید |
|---------------|--------------|
| `user`, `session`, `avatar` | صحنه / تم / پورتال |
| `lobby.wsUrl`, `lobby.roomId` | منطق «شروع مسابقه» |
| همگام‌سازی بازیکنان روی سوکت | گیم‌پلی بعد از خروج از لابی |

SDK صفحه را عوض نمی‌کند و چت را ذخیره نمی‌کند.

---

## پیش‌نیاز

1. `@oyna360/lobby-sdk` + `@babylonjs/core`
2. ترجیحاً `@platform/game-sdk` برای گرفتن Context
3. بازی در ادمین: `slug`, `entryUrl`, `allowedOrigins`
4. یک `<canvas>` اختصاصی لابی (اگر موتور دیگری دارید، canvas جدا)

---

## الگوی توصیه‌شده

```ts
import { PlatformSDK } from '@platform/game-sdk';
import { PlatformLobby } from '@oyna360/lobby-sdk';

const init = await PlatformSDK.init(/* Production: خالی | Direct: urls + slug */);

const lobby = await PlatformLobby.create({
  canvas,
  platformInit: init,
  roomId: init.lobby!.roomId,
  wsUrl: init.lobby!.wsUrl,
  config: {
    enableChat: true,
    enableVoice: true,
    locale: 'fa',
  },
});

lobby.applyPlazaLayout({
  onRoomStart: (room) => {
    lobby.destroy();
    startMatch(room.id);
  },
});
```

### جایگزین: `createFromPlatform`

فقط وقتی Context از قبل روی window/`platform:init` آمده (مثلاً بعد از `PlatformSDK.init()` یا parent iframe):

```ts
const lobby = await PlatformLobby.createFromPlatform(canvas, {
  spawnPoint: { x: 0, y: 0, z: 3 },
});
```

اگر نه iframe هستید و نه `init` زده‌اید، این متد timeout می‌دهد.

---

## ثبت در ادمین

| فیلد | Development | Production |
|------|-------------|------------|
| entryUrl | مثلاً `http://localhost:5180` | `https://games.example.com/` |
| allowedOrigins | همان origin کامل | همان |

برای Direct Development، origin را در `DEV_GAME_ORIGINS` / `allowedOrigins` هم مجاز کنید. جزئیات در مستندات game-sdk.

---

## اشتباهات تکراری

- هاردکد `http://localhost:3001/lobby`
- صدا زدن تابع export به نام `applyPlazaLayout` به‌جای **متد** `lobby.applyPlazaLayout`
- فراموش کردن `destroy()` قبل از گیم‌پلی سنگین
- استفاده از `createDev()` به‌جای اتصال واقعی
- نصب جداگانه `lobby-protocol` و shim دستی

بعدی: [03-modes.md](./03-modes.md)
