# اطلاعات آواتار در لابی اختصاصی بازی

`lobby-sdk` اتصال اوینا به لابی موجود بازی را برقرار می‌کند و اطلاعات آواتار را می‌دهد. SDK موتور بازی، loader مدل، decoder، صحنه یا renderer ایجاد و تنظیم نمی‌کند. نمایش آواتار با همان موتور و کد فعلی بازی است؛ برای دریافت اطلاعات آواتار نیازی به لابی آماده ندارید.

## دریافت داده با APIهای موجود

| نیاز | داده / API |
|---|---|
| ظاهر کاربر قبل از اتصال لابی | `platformInit.avatar` از خروجی game-sdk |
| ظاهر کاربر در snapshot سرور | `self.avatar` در `welcome` یا `client.self?.avatar` |
| ظاهر هر فرد دیگر | `player.avatar` یا `client.getPlayer(userId)?.avatar` |
| همهٔ بازیکنان، شامل خود کاربر | `client.getPlayers()` |
| فقط بازیکنان دیگر | `client.getRemotePlayers()` |
| وضعیت شخصی‌سازی محلی | `client.avatar.getState()` |
| شکل SDK از وضعیت شخصی‌سازی محلی | `client.avatar.toSdk()` |

`platformInit` را همراه `avatar` و `lobby` به `LobbyClient.create({ platformInit })` بدهید. `client.avatar` کنترلر **دادهٔ شخصی‌سازی** است، نه mesh بارگذاری‌شده. برای نمایش اولیه، اصل `platformInit.avatar` یا `player.avatar` را حفظ کنید.

## قرارداد داده

```ts
interface SdkLobbyAvatar {
  presetId: string;
  presetKey: string;
  presetKind: 'procedural' | 'glb';
  customConfig: Record<string, unknown>;
}
```

| فیلد | کاربرد |
|---|---|
| `presetId` / `presetKey` | شناسهٔ پایه؛ URL مدل را از این‌ها حدس نزنید |
| `customConfig.glbUrl` | آدرس مدل برای آواتار GLB |
| `customConfig.baseAlbedoUrl` | تکسچر مستقیم لباس/بدنه، در صورت وجود |
| `customConfig.colorVariants` و `colorVariantKey` | گزینه‌های تکسچر و انتخاب کاربر، در صورت وجود |
| `customConfig.accessories` | دادهٔ اکسسوری‌ها و در بعضی ظاهرها تکسچر لباس |
| `customConfig.attachments` | دادهٔ attachmentها، در صورت وجود |

فیلدهای اختیاری لزوماً در همهٔ آواتارها نیستند. خلاصه‌کردن payload به URL مدل می‌تواند اطلاعات لباس و اکسسوری را حذف کند. `user.avatarUrl` تصویر پروفایل است، نه GLB. `platformInit.avatarBases` کاتالوگ پایه‌هاست؛ اولین عضو آن لزوماً ظاهر انتخاب‌شدهٔ کاربر نیست.

## استخراج اطلاعات مدل و لباس

```ts
import { resolveGlbUrl, resolveAvatarBaseAlbedoUrl } from '@oyna360/lobby-sdk';

const appearance = client.self?.avatar ?? platformInit.avatar;
const modelUrl = resolveGlbUrl(appearance);
const baseAlbedoUrl = resolveAvatarBaseAlbedoUrl(appearance.customConfig);
const accessories = appearance.customConfig.accessories;

// اصل appearance و این اطلاعات را به بخش نمایش موجود بازی بدهید.
```

این دو helper فقط اطلاعات را استخراج می‌کنند؛ دانلود و رندر انجام نمی‌دهند. helper تکسچر، URL صریح، گزینهٔ رنگ منتخب/پیش‌فرض و سپس لباس دارای `appliesToBase` را بررسی می‌کند. اعمال تکسچر بر قسمت مناسب مدل با renderer بازی است؛ آن را کورکورانه روی صورت، مو و همهٔ اکسسوری‌ها اعمال نکنید.

URLهای مطلق پلتفرم را حفظ کنید. تبدیل آن‌ها به `/uploads/...` باعث درخواست فایل از دامنهٔ بازی می‌شود. اگر داده واقعاً نسبی است، آن را با آدرس معتبر پلتفرم محیط خودتان resolve کنید. دانلود بین دامنه‌ای به CORS درست میزبان فایل نیاز دارد.

### Draco

Draco فشرده‌سازی هندسهٔ داخل بعضی GLBهاست؛ روش جداگانه‌ای برای گرفتن هویت یا آواتار نیست. اطلاعات آواتار از همین SDK می‌آید. اگر مدل فشرده است، decoder مناسب باید در **loader موجود موتور بازی** تنظیم باشد. SDK اتصال، loader یا decoder موتور را تنظیم نمی‌کند. AI نباید به‌خاطر Draco موتور پروژه را عوض کند یا آواتار mock جایگزین کاربر کند.

## وصل‌کردن رویدادها به لابی خودتان

```ts
import { LobbyClient } from '@oyna360/lobby-sdk';
// این توابع متعلق به بازی شما هستند، نه SDK:
import { reconcilePlayers, addPlayer, removePlayer, updatePose, updateAppearance } from './my-lobby-view';

const client = LobbyClient.create({ platformInit });
client.on('welcome', ({ self, players }) => reconcilePlayers([self, ...players]));
client.on('player:join', (player) => addPlayer(player));
client.on('player:leave', ({ userId }) => removePlayer(userId));
client.on('player:update', (player) => updatePose(player));
client.on('player:avatar', ({ userId, avatar }) => updateAppearance(userId, avatar));
client.on('player:emote', ({ userId, emote }) => { /* انیمیشن در موتور خودتان */ });
client.connect();
```

توابع `my-lobby-view` را با همان موتور بازی پیاده کنید. برای هر فرد از `player.avatar` خودش استفاده کنید؛ آواتار کاربر محلی را برای همه کپی نکنید.

`welcome` snapshot کامل است و پس از reconnect هم می‌آید؛ افراد حذف‌شده را نیز از صحنه پاک کنید. برای هر userId یک نمایش نگه دارید. اگر هنگام دانلود مدل، فرد خارج شد یا ظاهرش عوض شد، نتیجهٔ دیررس قبلی را در صحنه نگذارید. هنگام خروج، `client.destroy()` و پاکسازی منابع صحنهٔ خود بازی هر دو لازم‌اند؛ SDK منابع GPU بازی را مدیریت نمی‌کند.

## شخصی‌سازی، فقط در سطح داده

`client.avatar.getState()` وضعیت را می‌دهد. `patchSkin()` تغییر جزئی است و `setSkin()` کل skin را جایگزین می‌کند؛ استفادهٔ اشتباه از آن می‌تواند اطلاعات تکسچر لباس را حذف کند.

```ts
const off = client.avatar.on('change', ({ state, reason }) => {
  const appearance = client.avatar.toSdk();
  // اعمال ظاهر محلی با renderer بازی خودتان
});
// پاکسازی listener اختصاصی:
// off();
```

`setBase`، `addAccessory`، `attach` و `setAnimation` داده را تغییر می‌دهند؛ به‌تنهایی مدل، اکسسوری، اتصال استخوان یا انیمیشن قابل نمایش نمی‌سازند. این‌ها API ذخیرهٔ دائمی آواتار در حساب کاربر هم نیستند.

هنگام اتصال، پیشنهاد تغییر از مسیر موجود `lobby:avatar:update` به سرور می‌رود و sanitize می‌شود. URLها و متادیتای دلخواه ممکن است حذف شوند؛ وضعیت پیشنهادی محلی را با ظاهر تأییدشدهٔ ارسالی به دیگران یکسان فرض نکنید.

## راهنمای کوتاه برای AI

> از lobby-sdk برای اتصال لابی موجود بازی به اوینا استفاده کن. payload واقعی را از game-sdk بگیر و به LobbyClient.create بده. ظاهر خود کاربر در platformInit.avatar/self.avatar و ظاهر هر فرد دیگر در player.avatar است. resolveGlbUrl و resolveAvatarBaseAlbedoUrl فقط اطلاعات مدل و تکسچر را می‌دهند. دانلود، Draco، رندر، انیمیشن و کنترل‌ها را با موتور و loader فعلی همان بازی انجام بده. موتور، لابی و APIهای SDK را تغییر نده، به لابی آماده مهاجرت نده و API رندر جدیدی به نام SDK اختراع نکن. اطلاعات لباس و اکسسوری را حفظ کن و رویدادها و snapshot کامل reconnect را به صحنهٔ خود بازی وصل کن.
