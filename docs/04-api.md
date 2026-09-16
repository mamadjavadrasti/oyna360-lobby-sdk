# API — `PlatformLobby`

## ساخت نمونه

### `PlatformLobby.create(options)`

```ts
interface PlatformLobbyCreateOptions {
  canvas: HTMLCanvasElement;
  platformInit: SdkInitPayload | PlatformInitMessage;
  roomId: string;
  wsUrl?: string;          // پیش‌فرض از platformInit.lobby.wsUrl
  strictRoom?: boolean;    // دعوت دوست؛ بدون spillover ظرفیت
  config?: PlatformLobbyConfig;
}
```

### `PlatformLobby.createFromPlatform(canvas, config?)`

منتظر Context روی window / `platform:init` می‌ماند، سپس `create` را صدا می‌زند.

### `PlatformLobby.createDev(options)`

Mock Context + معمولاً `enableMultiplayer: false`.

---

## `PlatformLobbyConfig` (مهم‌ترین‌ها)

| فیلد | پیش‌فرض | توضیح |
|------|---------|--------|
| `enableMultiplayer` | `true` | اتصال سوکت |
| `enableChat` | `true` | overlay چت |
| `enableVoice` | `true` | voice WebRTC |
| `enablePresenceUi` | با مالتی‌پلیر | toast ورود/خروج |
| `enableConnectionUi` | با مالتی‌پلیر | قطع اتصال |
| `enableOrientationUi` | `true` | اعلان landscape موبایل |
| `locale` | `'fa'` | `'fa'` \| `'en'` |
| `spawnPoint` / `spawnPoints` | — | محل اسپان |
| `playerSpeed` / `runMultiplier` | داخلی | حرکت |
| `cameraDistance` / `cameraHeight` | داخلی | دوربین |
| `quality` | `'auto'` | کیفیت رندر |
| `avatarBases` | — | کاتالوگ GLB |
| `preloadAvatarBases` | true | گرم کردن کش GLB |

---

## متدهای پرکاربرد

```ts
lobby.getUser();
lobby.getSession();
lobby.getAvatar();
lobby.getPlayers();

lobby.applyPlazaLayout({ onRoomStart, /* … */ });
lobby.applyStarterLayout({ /* … */ });

lobby.addZone({ id, bounds, onEnter, onExit });
lobby.addPortal({ id, /* … */ });

lobby.sendChat('سلام');
lobby.sendData('my-channel', payloadString); // کانال data جدا از چت

lobby.playEmote('wave');
lobby.attachChat();
lobby.destroy();
```

### رویدادها

```ts
lobby.on('chat', ({ displayName, text }) => {});
lobby.on('playerJoin', (player) => {});
lobby.on('playerLeave', ({ userId }) => {});
// و سایر رویدادهای LobbyEventMap
```

### Plugin

```ts
import { ShopZonePlugin, defineLobbyPlugin } from '@oyna360/lobby-sdk';
lobby.use(ShopZonePlugin);
```

---

## چیدمان

- **`applyPlazaLayout` (متد):** میدان، اتاق‌ها، برخورد — برای اکثر بازی‌ها.
- **`applyStarterLayout`:** چیدمان ساده‌تر استارتر.
- تابع‌های export هم‌نام را به‌جای متد صدا نزنید؛ برخورد به‌درستی اعمال نمی‌شود.

---

## چرخه عمر

1. create  
2. layout / zones  
3. بازیکن در لابی  
4. شروع مسابقه → **`destroy()`**  
5. موتور گیم‌پلی خودتان (مثلاً Three.js روی canvas دیگر)

دو موتور روی یک canvas توصیه نمی‌شود.

بعدی: [05-features.md](./05-features.md)
