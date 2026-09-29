# API — Core (`LobbyClient` / Avatar)

برای `PlatformLobby` → مستندات [`@oyna360/lobby-babylon`](https://www.npmjs.com/package/@oyna360/lobby-babylon).

---

## `LobbyClient`

```ts
import { LobbyClient } from '@oyna360/lobby-sdk';

const client = LobbyClient.create({
  platformInit,
  wsUrl?,      // اختیاری — از platformInit.lobby
  roomId?,
  strictRoom?,
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

```ts
client.avatar.getState();
client.avatar.setBase({ baseId, modelUrl?, presetKind? });
client.avatar.setSkin({ bodyColor?, tint?, baseAlbedoUrl? });
client.avatar.patchSkin({ … });
client.avatar.addAccessory({ id, itemId?, slot?, kind? });
client.avatar.removeAccessory(id);
client.avatar.attach({ id, bone?, slot?, … });
client.avatar.removeAttachment(id);
client.avatar.toSdk(); // SdkLobbyAvatar برای pipeline رندر
```

وقتی سوکت وصل است، تغییر ظاهر → `lobby:avatar:update` (سرور sanitize می‌کند).

---

## سایر exportهای مفید

`PlatformBridge`, `NetworkClient`, protocol helpers (`sanitizeLobbyChat`, …),  
`ZoneManager` / `PortalManager` (منطق bounds، بدون mesh), locomotion ریاضی.

---

## Breaking `0.2.0`

`PlatformLobby` از این پکیج حذف شد → `@oyna360/lobby-babylon`.
