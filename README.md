# @oyna360/lobby-sdk

SDK اصلی اتصال **لابی اختصاصی بازی شما** به اوینا: شبکه، کاربران، وضعیت اتاق، اطلاعات آواتار و پیام‌های لابی.

SDK به موتور بازی وابسته نیست. اطلاعات مدل، تکسچر، لباس و اکسسوری آواتار را به بازی می‌دهد؛ بارگذاری و نمایش آن‌ها در صحنهٔ موجود با خود بازی است. برای این اتصال نیازی به نصب لابی آماده یا تغییر موتور و لابی خودتان ندارید.

**مرجع توسعه‌دهنده و AI: [اطلاعات آواتار در لابی اختصاصی](./docs/08-avatar-data.md).**

## نصب

```sh
npm install @oyna360/lobby-sdk
```

هویت و سشن را از `@oyna360/game-sdk` دریافت کنید. موتور و ابزارهای رندر همان وابستگی‌های پروژهٔ بازی هستند.

## اتصال با API موجود

```ts
import { PlatformSDK } from '@oyna360/game-sdk';
import { LobbyClient } from '@oyna360/lobby-sdk';

const platformInit = await PlatformSDK.init(/* تنظیمات محیط خودتان */);
const client = LobbyClient.create({ platformInit });

client.on('welcome', ({ self, players, roomId }) => {
  // self.avatar: ظاهر کاربر فعلی
  // player.avatar: ظاهر همان بازیکن برای هر عضو players
  // کل snapshot را با صحنه و UI لابی خودتان تطبیق دهید.
});
client.on('player:join', (player) => { /* اضافه‌کردن به صحنهٔ خودتان */ });
client.on('player:leave', ({ userId }) => { /* پاکسازی نمایش همان کاربر */ });
client.on('player:update', (player) => { /* اعمال حرکت در صحنهٔ خودتان */ });
client.on('player:avatar', ({ userId, avatar }) => { /* اعمال ظاهر جدید */ });
client.on('error', ({ code, message }) => { /* نمایش خطای اتصال */ });

client.connect(); // پس از ثبت listenerها
// خروج از لابی:
// client.destroy();
```

`roomId` و `wsUrl` به‌صورت پیش‌فرض از `platformInit.lobby` می‌آیند؛ آن‌ها را هاردکد نکنید. `welcome` آماده‌شدن snapshot اتاق را اعلام می‌کند. پس از reconnect هم snapshot را کامل تطبیق دهید.

## گرفتن اطلاعات آواتار

```ts
import { resolveGlbUrl, resolveAvatarBaseAlbedoUrl } from '@oyna360/lobby-sdk';

const appearance = client.self?.avatar ?? platformInit.avatar;
const modelUrl = resolveGlbUrl(appearance);
const clothingTextureUrl = resolveAvatarBaseAlbedoUrl(appearance.customConfig);
const accessories = appearance.customConfig.accessories;

// داده‌ها را به loader و renderer موجود بازی خودتان بدهید.
// client.getPlayer(otherUserId)?.avatar: اطلاعات آواتار همان فرد دیگر
```

این helperها فقط اطلاعات را استخراج می‌کنند؛ فایل دانلود نمی‌کنند و mesh نمی‌سازند. `user.avatarUrl` تصویر پروفایل است، نه مدل سه‌بعدی. لباس، Draco، رویدادها و محدودیت‌های شخصی‌سازی در [راهنمای آواتار](./docs/08-avatar-data.md) توضیح داده شده‌اند.

## مستندات

| موضوع | راهنما |
|---|---|
| مسئولیت SDK و بازی | [00-overview.md](./docs/00-overview.md) |
| اتصال به لابی اختصاصی | [01-connect.md](./docs/01-connect.md) |
| نصب و build | [02-install.md](./docs/02-install.md) |
| نصب از GitHub | [02-github.md](./docs/02-github.md) |
| محیط واقعی و توسعه | [03-modes.md](./docs/03-modes.md) |
| APIهای موجود | [04-api.md](./docs/04-api.md) |
| متن، صوت و داده | [05-features.md](./docs/05-features.md) |
| ورودی و حرکت | [06-controls.md](./docs/06-controls.md) |
| عیب‌یابی | [07-troubleshooting.md](./docs/07-troubleshooting.md) |
| **قرارداد آواتار و راهنمای AI** | [08-avatar-data.md](./docs/08-avatar-data.md) |

## لایسنس

MIT
