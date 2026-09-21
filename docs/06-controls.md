# کنترل‌ها و موبایل

## دسکتاپ

| ورودی | عمل |
|-------|-----|
| WASD (`event.code`) | حرکت |
| Shift | دویدن |
| Space | پرش |
| E | تعامل / ایموجی |
| ماوس | چرخش دوربین سوم‌شخص |

## موبایل / لمسی

- اهرک مجازی: راه رفتن
- دکمه دویدن جدا
- دکمه پرش
- در portrait ممکن است overlay «افقی کنید» بیاید (`enableOrientationUi`)

## کیفیت

`config.quality = 'auto' | 'low' | 'medium' | 'high'`  
روی موبایل‌های ضعیف auto معمولاً به low/medium می‌رود.

## چند canvas

اگر گیم‌پلی با Three.js / موتور دیگر است:

1. canvas لابی برای `PlatformLobby`
2. canvas جدا برای مسابقه بعد از `destroy()`

همزمان دو رندرر WebGL سنگین روی موبایل ممکن است سفید/کرش شود.

بعدی: [07-troubleshooting.md](./07-troubleshooting.md)
