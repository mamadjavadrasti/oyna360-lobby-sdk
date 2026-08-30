# @platform/lobby-sdk

لابی ۳D oyna360 برای بازی‌سازان (Babylon.js).

پلتفرم فقط هویت، آواتار و سوکت را می‌دهد. ظاهر، پورتال و شروع گیم‌پلی مال بازی است.

**همین یک پکیج کافی است.** `@platform/lobby-protocol` را نصب نکنید — پروتکل داخل SDK است.

## اول استارتر، بعد بازی

منبع حقیقت این مونوریپو است: `packages/lobby-sdk` + الگوی `apps/examples/lobby-demo`.

دمو با `workspace:*` همین کد را لود می‌کند. پکیج GitHub فقط وقتی درست است که بعد از آخرین تغییر، `dist` بیلد و پوش شده باشد.

**چطور کپی کنید (تا دمو کار کند و بازی خراب نشود):**

1. `npm run lobby:demo` — http://localhost:5174
2. `lobby-config.ts` و الگوی `main.ts` استارتر را به بازی کپی کنید
3. همین پوشه را بعد از `pnpm --filter @platform/lobby-sdk build` داخل ریپوی بازی بگذارید، **یا** تگ تازهٔ GitHub را پین کنید
4. به مسیر لوکال ریپوی پلتفرم alias ندهید (روی سرور نیست)
5. تست از `/play/{slug}` نه از پورت خام بازی

راهنمای کامل و لیست اشتباهات تکراری: [docs/lobby-sdk-integration.md](../../docs/lobby-sdk-integration.md#چطور-از-استارتر-استفاده-کنید)

`dist` سالم این فایل‌ها را دارد: `humanoid-animator.js`, `third-person-camera.js`, `lobby-colliders.js`, `protocol.js`, `lobby-chat-ui.js`. اگر `index.js` هنوز `@platform/lobby-protocol` import کند، بیلد کهنه است.

## نصب در پروژهٔ بازی

ترجیح: workspace با `dist` همین پکیج.

```bash
# فقط اگر GitHub با dist تازه پوش شده
npm install github:mamadjavadrasti/oyna360-lobby-sdk#<tag> @babylonjs/core
```

```json
{
  "dependencies": {
    "@platform/lobby-sdk": "*",
    "@babylonjs/core": "^7.44.0"
  }
}
```

مستندات وصل: [docs/01-connect.md](docs/01-connect.md) · انتشار GitHub: [docs/02-github.md](docs/02-github.md)

## شروع سریع

کپی از استارتر بهتر از حداقل زیر است.

```typescript
import { PlatformLobby } from '@platform/lobby-sdk';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const lobby = await PlatformLobby.createFromPlatform(canvas, {
  spawnPoint: { x: 0, y: 0, z: 3 },
  cameraDistance: 9.5,
  cameraHeight: 5,
});

lobby.applyPlazaLayout({
  onRoomStart: (room) => startGameplay(room),
});

lobby.getUser();
lobby.getAvatar();
lobby.getSession();
lobby.getPlayers();
```

متد `lobby.applyPlazaLayout` برخورد و زمین‌بازی را هم می‌گذارد. تابع exportشدهٔ هم‌نام این کار را نمی‌کند.

بدون پلتفرم (تست لوکال):

```typescript
const lobby = await PlatformLobby.createDev({
  canvas,
  roomId: 'game:my-game',
  config: { enableMultiplayer: false },
});
```

## چت

زنده، بدون ذخیره. پیش‌فرض دکمه 💬 روی لابی (`enableChat: false` برای خاموش).

```typescript
lobby.sendChat('سلام');
lobby.on('chat', ({ displayName, text }) => {});
```

## پیش‌نیاز پلتفرم

| فیلد | مثال |
|------|------|
| `entryUrl` | `https://games.example.com/my-game/` |
| `allowedOrigins` | `https://games.example.com` |

بازیکن از `/play/{slug}` وارد می‌شود. پلتفرم `platform:init` می‌فرستد. `lobby.wsUrl` را هاردکد نکنید.

## کنترل

- کیبورد: WASD (`event.code`)، Shift دویدن، Space پرش، E تعامل/ایموجی
- ماوس: چرخش دوربین
- موبایل: اهرم = راه رفتن؛ دکمهٔ دویدن جدا
- Babylon و موتور دیگر (مثل Three.js) روی دو canvas جدا

## لایسنس

MIT
