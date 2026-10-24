# @oyna360/lobby-sdk

**Core** لابی oyna360 — شبکه، state اتاق/بازیکن، AvatarState.  
بدون Babylon.js.

برای رندر ۳D و `PlatformLobby` از [`@oyna360/lobby-babylon`](https://www.npmjs.com/package/@oyna360/lobby-babylon) استفاده کنید.

**لود آواتار برای AI و بازی‌ساز:** [راهنمای استاندارد آواتار در lobby-babylon](https://github.com/mamadjavadrasti/oyna360-lobby-babylon/blob/master/docs/08-avatars.md). این پکیج Core فقط state و شبکه را مدیریت می‌کند؛ GLB/Draco را رندر نمی‌کند.

**نسخهٔ سورس:** `0.3.0` · پروتکل داخل همین پکیج است — `@platform/lobby-protocol` را نصب نکنید.

تماس زندهٔ گروهی و چت متنی از مسیر مستقل `LobbyCommunications` پشتیبانی می‌شود؛ در لابی آماده خودکار است. [راهنمای اتصال و مجوزها](https://github.com/mamadjavadrasti/oyna360-lobby-babylon/blob/master/docs/09-communications.md).

> لاگین / Authorize کار [`@oyna360/game-sdk`](https://www.npmjs.com/package/@oyna360/game-sdk) است.

---

## نصب

```bash
npm install @oyna360/lobby-sdk
# یا
pnpm add @oyna360/lobby-sdk
```

```json
{
  "dependencies": {
    "@oyna360/lobby-sdk": "^0.3.0"
  }
}
```

این پکیج **peer به Babylon ندارد**. فقط `socket.io-client` را می‌آورد.

### لابی ۳D (Babylon)

```bash
npm install @oyna360/lobby-babylon @oyna360/lobby-sdk @babylonjs/core
```

معمولاً فقط `@oyna360/lobby-babylon` کافی است (Core را به‌صورت dependency می‌آورد و بسیاری از نمادهای Core را re-export می‌کند).

---

## معماری

```text
@oyna360/lobby-sdk          ← Core (این پکیج)
        ↑
@oyna360/lobby-babylon      ← PlatformLobby / Avatar / Scene
```

| پکیج | مسئولیت |
|------|---------|
| `lobby-sdk` | `LobbyClient`, `LobbyAvatarController`, protocol, room/player SoT |
| `lobby-babylon` | `PlatformLobby`, AvatarFactory, صحنه Babylon |

---

## شروع سریع — فقط Core (بدون Babylon)

```ts
import { LobbyClient } from '@oyna360/lobby-sdk';

const client = LobbyClient.create({
  platformInit, // از game-sdk / platform:init
});

client.on('welcome', ({ self, players }) => {
  console.log(self.userId, players.length);
});

client.connect();

client.avatar.setSkin({ bodyColor: '#4f46e5' });
// وقتی وصل است → lobby:avatar:update به سرور می‌رود

client.sendChat('سلام');
client.destroy();
```

---

## Avatar API (محلی + sync)

```ts
client.avatar.getState();
client.avatar.setBase({ baseId: 'default-1' });
client.avatar.setSkin({ tint: '#112233' });
client.avatar.addAccessory({ id: 'hat-1', itemId: 'cap', slot: 'hat' });
client.avatar.removeAccessory('hat-1');
client.avatar.attach({ id: 'prop-1', bone: 'handR' });
client.avatar.removeAttachment('prop-1');
```

تغییرات ظاهر بعد از اتصال، از مسیر سرور validate و به remoteها broadcast می‌شوند (`lobby:avatar:update` → `lobby:player:avatar`).

---

## مستندات

| موضوع | فایل |
|--------|------|
| نقش Core و مرز با Babylon | [docs/00-overview.md](./docs/00-overview.md) |
| نصب / publish | [docs/02-install.md](./docs/02-install.md) |
| LobbyClient / AvatarState | [docs/04-api.md](./docs/04-api.md) |
| عیب‌یابی Core | [docs/07-troubleshooting.md](./docs/07-troubleshooting.md) |

رندر و `PlatformLobby`: مستندات [`@oyna360/lobby-babylon`](https://github.com/mamadjavadrasti/oyna360-lobby-babylon/blob/master/README.md).

---

## Breaking change در `0.2.0`

از این نسخه، `PlatformLobby` دیگر از `@oyna360/lobby-sdk` export نمی‌شود.

```diff
- import { PlatformLobby } from '@oyna360/lobby-sdk';
+ import { PlatformLobby } from '@oyna360/lobby-babylon';
```

---

## لایسنس

MIT
