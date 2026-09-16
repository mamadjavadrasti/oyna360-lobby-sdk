# @oyna360/lobby-sdk

لابی سه‌بعدی **oyna360** برای بازی‌سازان — بر پایه Babylon.js.

پلتفرم هویت، آواتار و اتاق WebSocket را می‌دهد.  
**ظاهر لابی، پورتال‌ها و شروع گیم‌پلی مال شماست.**

**نسخه پکیج:** مطابق GitHub tag · پروتکل داخل همین پکیج است — `@platform/lobby-protocol` را نصب نکنید.

> اتصال اولیه به پلتفرم (سشن / Authorize) کار [`@platform/game-sdk`](https://github.com/mamadjavadrasti/playhub-game-sdk) است. این SDK لابی را اجرا می‌کند، لاگین نمی‌کند.

---

## نصب

```bash
npm install github:mamadjavadrasti/oyna360-lobby-sdk#master @babylonjs/core
```

`@babylonjs/core` peer dependency است (نسخه ۷ توصیه می‌شود).

```json
{
  "dependencies": {
    "@oyna360/lobby-sdk": "github:mamadjavadrasti/oyna360-lobby-sdk#master",
    "@babylonjs/core": "^7.44.0"
  }
}
```

تگ/`dist` تازه را پین کنید. اگر `dist/index.js` هنوز `@platform/lobby-protocol` import کند، بیلد کهنه است.

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
import { PlatformSDK } from '@platform/game-sdk';
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
| انتشار از GitHub | [docs/02-github.md](./docs/02-github.md) |

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
