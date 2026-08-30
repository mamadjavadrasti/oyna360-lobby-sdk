# وصل کردن بازی به لابی

لابی از سمت پلتفرم آماده است. پلتفرم بازیکن را داخل گیم‌پلی نمی‌گذارد. هویت، آواتار و اتاق را می‌دهد؛ بازی ظاهر، پورتال و شروع مسابقه را خودش می‌سازد.

همین پکیج `@platform/lobby-sdk` کافی است. `lobby-protocol` لازم نیست.

اول استارتر را کپی کنید، از صفر ننویسید. جزئیات و تله‌ها: [lobby-sdk-integration.md](../../../docs/lobby-sdk-integration.md#چطور-از-استارتر-استفاده-کنید).

---

## قرارداد

| پلتفرم می‌دهد | بازی باید بسازد |
|---------------|-----------------|
| کاربر، سشن، JWT | صحنه / ظاهر لابی |
| آواتار انتخاب‌شده | جای پورتال و برچسب‌ها |
| بازیکنان اتاق + حرکت + چت زنده | بعد از ورود به پورتال / اتمام شمارش اتاق چه می‌شود |
| سوکت `lobby:*`، اتاق `game:{slug}` | نصب SDK داخل پروژهٔ بازی |

`toGameSlug` و `toScene` فقط راهنما هستند. SDK هرگز صفحه را عوض نمی‌کند. چت ذخیره نمی‌شود.

---

## از استارتر بیاورید

1. در روت پلتفرم: `npm run lobby:demo` → http://localhost:5174
2. کپی `apps/examples/lobby-demo/src/lobby-config.ts` و الگوی `main.ts`
3. همین SDK را بعد از `pnpm --filter @platform/lobby-sdk build` به بازی بدهید (workspace داخل ریپوی بازی، یا تگ GitHub با `dist` تازه)
4. به فولدر پلتفرم روی دیسک لوکال alias ندهید
5. تست از `/play/{slug}` با `entryUrl` همان پورت بازی

اگر بیلد گفت `@platform/lobby-protocol` resolve نشد، shim ننویسید — `dist` کهنه است.

---

## پیش‌نیاز

1. بازی روی URL عمومی (یا `http://localhost:PORT`) host شده باشد.
2. در ادمین: `slug` + `entryUrl` + `allowedOrigins`
3. بازیکن از `/play/{slug}` وارد شود و لاگین باشد.
4. `@platform/lobby-sdk` هم‌نسخهٔ استارتر + `@babylonjs/core`

---

## جریان

```
لاگین → /play/{slug}
  → iframe با entryUrl
  → platform:init  (user, session, avatar, lobby.wsUrl, lobby.roomId)
  → PlatformLobby.createFromPlatform(canvas)
  → ورود پورتال / اتمام شمارش اتاق
  → بازی startGameplay() را صدا می‌زند
```

---

## کد حداقل

```typescript
import { PlatformLobby } from '@platform/lobby-sdk';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const lobby = await PlatformLobby.createFromPlatform(canvas, {
  spawnPoint: { x: 0, y: 0, z: 3 },
  cameraDistance: 9.5,
  cameraHeight: 5,
});

function startGameplay(reason: { kind: 'portal' | 'room'; id: string }) {
  lobby.destroy();
}

lobby.applyPlazaLayout({
  onRoomStart: (room) => startGameplay({ kind: 'room', id: room.id }),
});
```

`lobby.applyPlazaLayout` متد است (برخورد + زمین‌بازی). تابع export را صدا نزنید.

چت: پیش‌فرض 💬. `enableChat: false` / `sendChat` / `on('chat')`.

---

## ثبت در ادمین

| فیلد | لوکال | پروداکشن |
|------|--------|-----------|
| entryUrl | پورت Vite بازی، مثلاً `http://localhost:5180` | `https://games.example.com/` |
| allowedOrigins | همان origin | همان origin |

سوکت از `platform:init.lobby.wsUrl` می‌آید. به `localhost:3001` هاردکد نکنید.

---

## چک‌لیست

- [ ] استارتر را دیده‌اید؛ `dist` شامل animator / colliders / protocol / chat
- [ ] دو canvas اگر موتور دیگری دارید
- [ ] `entryUrl` + `allowedOrigins` درست
- [ ] تست از `/play/{slug}` نه پورت خام
- [ ] `applyPlazaLayout` متد + `destroy()` قبل از گیم‌پلی
