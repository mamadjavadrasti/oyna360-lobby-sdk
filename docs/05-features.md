# امکانات — آواتار، چت، voice، data

## آواتار

از `platformInit.avatar` ساخته می‌شود (procedural یا GLB).

- رنگ / لباس / اکسسوری از `customConfig`
- `avatarBases` برای پیش‌بارگذاری چند بدنهٔ GLB مشترک
- انیمیشن راه رفتن / دویدن / پرش داخل SDK

بازی معمولاً لازم نیست `AvatarFactory` را مستقیم صدا بزند مگر ابزار سفارشی بسازید.

URL تکسچر و GLB باید از پلتفرم **مطلق** باشند تا از origin بازی cross-origin لود شوند (CORS روی `/uploads` سمت پلتفرم فعال است).

---

## چت

- زنده، بدون ذخیره دائمی
- `enableChat: false` برای خاموش کردن UI پیش‌فرض
- `sendChat(text)` / رویداد `chat`

برای فریم‌های کنترلی بازی (مثلاً matchmaking) از چت استفاده نکنید → کانال data.

---

## Voice

- با `enableVoice` (پیش‌فرض روشن وقتی مالتی‌پلیر باشد)
- محدودیت تعداد peer نزدیک روی سرور تنظیم می‌شود
- نیاز به مجوز میکروفون مرورگر

---

## کانال `lobby:data`

پیام‌های باینری/متنی کوتاه برای منطق بازی، جدا از چت.

```ts
lobby.sendData('fc.pad-room', frameString);

lobby.on('data', ({ channel, payload, fromUserId }) => {
  if (channel === 'fc.pad-room') handleFrame(payload);
});
```

محدودیت اندازه و نرخ از سمت سرور اعمال می‌شود. چت را sanitize نکنید روی data — فرمت خودتان را validate کنید.

---

## Presence / اتصال

UIهای آماده برای ورود بازیکن و قطع شبکه را می‌توان با فلگ‌های config خاموش کرد و UI خودتان را گذاشت.

بعدی: [06-controls.md](./06-controls.md)
