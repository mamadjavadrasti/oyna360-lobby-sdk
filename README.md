# @oyna360/lobby-sdk

لابی سه‌بعدی **oyna360** برای بازی‌سازان — بر پایه Babylon.js.

پلتفرم هویت، آواتار و اتاق WebSocket را می‌دهد.  
**ظاهر لابی، پورتال‌ها و شروع گیم‌پلی مال شماست.**

**نسخه پکیج:** `0.1.2` روی npm · پروتکل داخل همین پکیج است — `@platform/lobby-protocol` را نصب نکنید.

> اتصال اولیه به پلتفرم (سشن / Authorize) کار [`@oyna360/game-sdk`](https://www.npmjs.com/package/@oyna360/game-sdk) است. این SDK لابی را اجرا می‌کند، لاگین نمی‌کند.

---

## نصب

```bash
npm install @oyna360/lobby-sdk @babylonjs/core
# یا
pnpm add @oyna360/lobby-sdk @babylonjs/core
```

`@babylonjs/core` peer dependency است (نسخه ۷ توصیه می‌شود).

```json
{
  "dependencies": {
    "@oyna360/lobby-sdk": "^0.1.2",
    "@babylonjs/core": "^7.44.0"
  }
}
```

نسخه را در [npm](https://www.npmjs.com/package/@oyna360/lobby-sdk) ببینید.

### به‌روزرسانی

```bash
npm install @oyna360/lobby-sdk@latest
# یا
pnpm update @oyna360/lobby-sdk
```

بعد از آپدیت، کش Vite را پاک کنید: `rm -rf node_modules/.vite`

---

## سه حالت ورود به لابی

| حالت | کی استفاده کنید | API |
|------|------------------|-----|
| **Production** | بازیکن از `/play/{slug}` آمده | `createFromPlatform` یا `create({ platformInit })` بعد از game-sdk |
| **Direct Development** | بازی روی origin خودتان + game-sdk Authorize | `create({ platformInit })` با Context از `PlatformSDK.init()` |
| **Offline / Fake** | تست UI بدون سرور | `createDev()` — مالتی‌پلیر واقعی ندارد |

---

## شروع سریع — با پلتفرم واقعی

```ts
import { PlatformSDK } from '@oyna360/game-sdk';
import { PlatformLobby } from '@oyna360/lobby-sdk';

const canvas = document.getElementById('lobby') as HTMLCanvasElement;

// 1) Context از پلتفرم (iframe یا Direct Dev)
const init = await PlatformSDK.init({
  // Direct فقط:
  // platformUrl, platformWebUrl, gameSlug
});

// 2) لابی واقعی
const lobby = await PlatformLobby.create({
  canvas,
  platformInit: init,
  roomId: init.lobby!.roomId,
  wsUrl: init.lobby!.wsUrl,
});

lobby.applyPlazaLayout({
  onRoomStart: (room) => {
    lobby.destroy();
    startGameplay(room.id);
  },
});
```

`wsUrl` / `roomId` را هاردکد نکنید.

---

## شروع سریع — فقط UI آفلاین

```ts
const lobby = await PlatformLobby.createDev({
  canvas,
  roomId: 'game:my-game',
  config: { enableMultiplayer: false },
});
lobby.applyPlazaLayout();
```

این مسیر برای توسعه ظاهر است، نه تست مالتی‌پلیر روی سرور.

---

## مستندات

| موضوع | فایل |
|--------|------|
| نقش SDK و مرز با game-sdk | [docs/00-overview.md](./docs/00-overview.md) |
| اتصال و پیش‌نیاز | [docs/01-connect.md](./docs/01-connect.md) |
| حالت‌های Production / Direct / Dev | [docs/03-modes.md](./docs/03-modes.md) |
| API `PlatformLobby` | [docs/04-api.md](./docs/04-api.md) |
| آواتار، چت، voice، data | [docs/05-features.md](./docs/05-features.md) |
| کنترل‌ها و موبایل | [docs/06-controls.md](./docs/06-controls.md) |
| عیب‌یابی | [docs/07-troubleshooting.md](./docs/07-troubleshooting.md) |
| انتشار / نصب از npm | [docs/02-install.md](./docs/02-install.md) |

---

## امکانات اصلی

- صحنه Babylon، دوربین سوم‌شخص، برخورد
- آواتار procedural / GLB + اکسسوری
- بازیکنان remote، حرکت، انیمیشن
- چت زنده، presence، voice (اختیاری)
- کانال `lobby:data` برای matchmaking / کنترل بازی
- Plaza / Starter layout، zone، portal، plugin
- کیفیت خودکار و UI فارسی/انگلیسی

---

## لایسنس

MIT
