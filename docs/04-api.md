# API — Core (`LobbyClient` / Avatar)

SDK اتصال و داده‌ها را مدیریت می‌کند؛ نمایش با موتور و لابی خود بازی است. [قرارداد اطلاعات آواتار](./08-avatar-data.md).

---

## `LobbyClient`

```ts
import { LobbyClient } from '@oyna360/lobby-sdk';

const client = LobbyClient.create({
  platformInit,
  // wsUrl و roomId به‌صورت پیش‌فرض از platformInit.lobby می‌آیند.
  // strictRoom نیز در صورت نیاز قابل تنظیم است.
});

client.on('welcome', handler); // قبل از connect ثبت کنید
client.connect();

await LobbyClient.connect({ platformInit }); // create + connect
```

### متدها

```ts
client.getPlayers();        // همه (شامل self بعد از welcome)
client.getRemotePlayers();  // بدون self
client.getPlayer(userId);
client.self;
client.roomId;
client.isConnected();

client.sendMove({ position, rotationY, animation });
client.sendChat(text);
client.sendData(channel, payload);
client.sendEmote(emote);
client.destroy();
```

### رویدادها (نمونه)

| Event | معنی |
|-------|------|
| `welcome` | snapshot اتاق |
| `player:join` / `player:leave` / `player:update` | حضور / حرکت |
| `player:avatar` | ظاهر remote بعد از validate سرور |
| `player:emote` | اموجی |
| `chat` / `data` | پیام‌ها |
| `connected` / `disconnected` / `reconnecting` | سوکت |
| `error` | خطا |

---

## `LobbyAvatarController` — `client.avatar`

این API دادهٔ شخصی‌سازی است. `setSkin` جایگزینی کامل و `patchSkin` ادغام جزئی است؛ تغییر داده، مدل یا mesh ایجاد نمی‌کند و تضمین ذخیره در حساب کاربر نیست. [راهنمای آواتار و اعمال تغییرات در بازی](./08-avatar-data.md).

```ts
client.avatar.getState();
client.avatar.patchSkin({ bodyColor: '#4f46e5' });
client.avatar.toSdk(); // دادهٔ SdkLobbyAvatar؛ نمایش آن با بازی است.
```

وقتی سوکت وصل است، تغییر ظاهر → `lobby:avatar:update` (سرور sanitize می‌کند).

---

## سایر exportهای مفید

`PlatformBridge`, `NetworkClient`, protocol helpers (`sanitizeLobbyChat`, …),  
`ZoneManager` / `PortalManager` (منطق bounds، بدون mesh), locomotion ریاضی.

---

## محدودهٔ API

اتصال به اوینا با LobbyClient است. SDK موتور، صحنه، mesh و کنترلر بازی نمی‌سازد؛ این مسئولیت‌ها در همان پروژهٔ بازی باقی می‌مانند.
