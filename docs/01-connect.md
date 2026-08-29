# وصل کردن بازی به لابی

لابی از سمت پلتفرم آماده است. پلتفرم بازیکن را داخل گیم‌پلی نمی‌گذارد. هویت، آواتار و اتاق را می‌دهد؛ بازی ظاهر، پورتال و شروع مسابقه را خودش می‌سازد.

همین پکیج `@platform/lobby-sdk` کافی است. `lobby-protocol` لازم نیست.

---

## قرارداد

| پلتفرم می‌دهد | بازی باید بسازد |
|---------------|-----------------|
| کاربر، سشن، JWT | صحنه / ظاهر لابی |
| آواتار انتخاب‌شده | جای پورتال و برچسب‌ها |
| بازیکنان اتاق + حرکت | بعد از ورود به پورتال / اتمام شمارش اتاق چه می‌شود |
| سوکت `lobby:*`، اتاق `game:{slug}` | نصب SDK داخل پروژهٔ بازی |

`toGameSlug` و `toScene` فقط راهنما هستند. SDK هرگز صفحه را عوض نمی‌کند.

---

## پیش‌نیاز

1. بازی روی URL عمومی (یا `http://localhost:PORT`) host شده باشد.
2. در ادمین: `slug` + `entryUrl` + `allowedOrigins`
3. بازیکن از `/play/{slug}` وارد شود و لاگین باشد.
4. نصب:

```bash
npm install github:mamadjavadrasti/oyna360-lobby-sdk @babylonjs/core
```

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
});

function startGameplay(reason: { kind: 'portal' | 'room'; id: string }) {
  lobby.destroy();
  // مسابقه / صحنه خودتان
}

lobby.on('ready', () => {
  lobby.addPortal({
    id: 'play',
    position: { x: 0, y: 0, z: 10 },
    toScene: 'gameplay',
    onTrigger: () => startGameplay({ kind: 'portal', id: 'play' }),
  });
});

lobby.getUser();
lobby.getAvatar();
lobby.getSession();
lobby.getPlayers();
```

پلازا اختیاری:

```typescript
lobby.applyPlazaLayout({
  rooms: myRooms,
  onRoomStart: (room) => startGameplay({ kind: 'room', id: room.id }),
});
```

---

## ثبت در ادمین

| فیلد | لوکال | پروداکشن |
|------|--------|-----------|
| entryUrl | `http://localhost:5174` | `https://games.example.com/` |
| allowedOrigins | `http://localhost:5174` | `https://games.example.com` |

سوکت از `platform:init.lobby.wsUrl` می‌آید. به `localhost:3001` هاردکد نکنید.

---

## چک‌لیست

- [ ] `entryUrl` + `allowedOrigins` درست
- [ ] `createFromPlatform` بعد از لود canvas
- [ ] پورتال یا `onRoomStart` که گیم‌پلی را شروع کند
- [ ] `lobby.destroy()` قبل از گیم‌پلی
- [ ] تست: `/play/{slug}` → حرکت → پورتال → گیم‌پلی
