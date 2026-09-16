# نصب از GitHub

پکیج برای بازی‌سازان از ریپوی عمومی منتشر می‌شود:

`https://github.com/mamadjavadrasti/oyna360-lobby-sdk`

## نصب پایدار

```bash
npm install github:mamadjavadrasti/oyna360-lobby-sdk#master
# بهتر: تگ نسخه وقتی توسط تیم پلتفرم زده شد
npm install github:mamadjavadrasti/oyna360-lobby-sdk#v0.x.x
```

همیشه `@babylonjs/core` را جدا نصب کنید.

## بررسی سلامت `dist`

بعد از نصب، در `node_modules/@oyna360/lobby-sdk/dist/index.js`:

- نباید `from '@platform/lobby-protocol'` دیده شود
- باید فایل‌هایی مثل `platform-lobby.js`, `protocol.js`, `avatar-factory.js` وجود داشته باشد

## به‌روزرسانی

```bash
npm install github:mamadjavadrasti/oyna360-lobby-sdk#master --force
# کش Vite را پاک کنید
rm -rf node_modules/.vite
```

یا کپی دستی `dist` از maintainer (pack) داخل `node_modules/@oyna360/lobby-sdk`.

## ارتباط با game-sdk

lobby-sdk وابسته به game-sdk نیست؛ ولی در عمل برای Context واقعی هر دو را نصب کنید:

```bash
npm install github:mamadjavadrasti/oyna360-game-sdk#v0.5.0
npm install github:mamadjavadrasti/oyna360-lobby-sdk#master @babylonjs/core
```
