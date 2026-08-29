# @platform/lobby-sdk

لابی ۳D oyna360 برای بازی‌سازان (Babylon.js).

پلتفرم فقط هویت، آواتار و سوکت را می‌دهد. ظاهر، پورتال و شروع گیم‌پلی مال بازی است.

**همین یک پکیج کافی است.** `@platform/lobby-protocol` را نصب نکنید — پروتکل داخل SDK است.

## نصب در پروژهٔ بازی

```bash
npm install github:mamadjavadrasti/oyna360-lobby-sdk @babylonjs/core
```

یا با تگ نسخه:

```bash
npm install github:mamadjavadrasti/oyna360-lobby-sdk#v0.1.0 @babylonjs/core
```

```json
{
  "dependencies": {
    "@platform/lobby-sdk": "github:mamadjavadrasti/oyna360-lobby-sdk#v0.1.0",
    "@babylonjs/core": "^7.44.0"
  }
}
```

مستندات کامل: [docs/01-connect.md](docs/01-connect.md)

## شروع سریع

```typescript
import { PlatformLobby } from '@platform/lobby-sdk';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const lobby = await PlatformLobby.createFromPlatform(canvas);

lobby.on('ready', () => {
  lobby.addPortal({
    id: 'play',
    position: { x: 0, y: 0, z: 10 },
    toScene: 'gameplay',
    onTrigger: () => startGameplay(),
  });
});

lobby.getUser();
lobby.getAvatar();
lobby.getSession();
lobby.getPlayers();
```

بدون پلتفرم (تست لوکال):

```typescript
const lobby = await PlatformLobby.createDev({
  canvas,
  roomId: 'game:my-game',
  config: { enableMultiplayer: false },
});
```

## پیش‌نیاز پلتفرم

در ادمین oyna360 برای بازی:

| فیلد | مثال |
|------|------|
| `entryUrl` | `https://games.example.com/my-game/` |
| `allowedOrigins` | `https://games.example.com` |

بازیکن از `/play/{slug}` وارد می‌شود. پلتفرم `platform:init` می‌فرستد.

## کنترل

- کیبورد: WASD، Shift دویدن، Space پرش
- موبایل: اهرم حرکت = راه رفتن؛ دکمهٔ دویدن جداست

## لایسنس

MIT
