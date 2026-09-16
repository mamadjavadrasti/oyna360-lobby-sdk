# عیب‌یابی — lobby-sdk

## Timed out waiting for platform:init

- داخل iframe نیستید و `PlatformSDK.init()` را قبلش صدا نزده‌اید.
- یا parent پلتفرم init نفرستاده.

**راه:** اول game-sdk `init`، بعد `create({ platformInit })`.

## صفحه سفید / HUD هست صحنه نیست

اغلب سنگینی آواتار GLB یا WebGL context روی موبایل. کیفیت را `low` کنید، تعداد remote را کم کنید، مدل را سبک کنید.

## بازیکن remote دیده نمی‌شود

- `enableMultiplayer: true`
- `session.token` واقعی است (نه `dev-token`)
- `wsUrl` به همان محیطی اشاره می‌کند که سشن ساخته شده
- فایروال / mixed content (https صفحه با ws ناامن)

## آواتار نامرئی / منفجر

مدل GLB ناسازگار؛ از presetهای تأییدشده پلتفرم استفاده کنید. مسیر bake/fallback داخل SDK برای بعضی مدل‌ها هست ولی مدل بسیار سنگین موبایل را می‌خواباند.

## چت می‌آید ولی data نه

کانال data جداست؛ فلگ/مجوز سرور و طول payload را چک کنید. متن را در چت نفرستید.

## `applyPlazaLayout` برخورد ندارد

متد روی instance را صدا بزنید نه تابع export خام.

## ساخت از GitHub خراب است

`dist` باید بدون import به `@platform/lobby-protocol` باشد. تگ را عوض کنید یا از maintainer بخواهید pack تازه بگذارد.

## createDev به سرور وصل نمی‌شود

عمدی است. برای مالتی‌پلیر واقعی Direct یا Production را استفاده کنید.
