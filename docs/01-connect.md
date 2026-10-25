# اتصال لابی اختصاصی به اوینا

```ts
import { PlatformSDK } from '@oyna360/game-sdk';
import { LobbyClient } from '@oyna360/lobby-sdk';

const platformInit = await PlatformSDK.init(/* تنظیمات محیط خودتان */);
const client = LobbyClient.create({ platformInit });

client.on('welcome', ({ roomId, self, players }) => {
  // snapshot کامل: خود کاربر + بازیکنان دیگر
  // ظاهر هر بازیکن در player.avatar همان فرد است.
  // صحنه و UI موجود بازی را با این snapshot تطبیق دهید.
});
client.on('player:join', (player) => { /* نمایش فرد در بازی */ });
client.on('player:leave', ({ userId }) => { /* پاکسازی نمایش فرد */ });
client.on('player:update', (player) => { /* اعمال حرکت در بازی */ });
client.on('player:avatar', ({ userId, avatar }) => { /* اعمال ظاهر در بازی */ });
client.on('error', ({ code, message }) => { /* مدیریت خطای شبکه */ });
client.connect();
```

listenerها را پیش از connect ثبت کنید. اتصال سوکت با آماده‌شدن snapshot یکی نیست؛ فهرست معتبر در `welcome` می‌آید. پس از reconnect هم snapshot جدید را کامل تطبیق دهید.

`wsUrl`، `roomId` و سشن را از payload محیط خودتان بگیرید. در حالت عادی نیازی به override یا هاردکد نیست. هنگام خروج `client.destroy()` را صدا بزنید و منابع صحنهٔ بازی را خودتان پاک کنید.

[قرارداد اطلاعات آواتار و مثال اتصال به نمایش بازی](./08-avatar-data.md)
