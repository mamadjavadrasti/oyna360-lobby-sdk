# نصب و به‌روزرسانی (npm)

پکیج‌های رسمی روی **npm** منتشر می‌شوند:

| پکیج | npm |
|------|-----|
| Lobby SDK | [`@oyna360/lobby-sdk`](https://www.npmjs.com/package/@oyna360/lobby-sdk) |
| Game SDK | [`@oyna360/game-sdk`](https://www.npmjs.com/package/@oyna360/game-sdk) |

## نصب lobby-sdk

```bash
npm install @oyna360/lobby-sdk @babylonjs/core
# یا
pnpm add @oyna360/lobby-sdk @babylonjs/core
```

```json
{
  "dependencies": {
    "@oyna360/lobby-sdk": "^0.1.0",
    "@babylonjs/core": "^7.44.0"
  }
}
```

همیشه `@babylonjs/core` را جدا نصب کنید (peer dependency).

## نصب هر دو (لابی + هویت / امتیاز)

```bash
npm install @oyna360/game-sdk @oyna360/lobby-sdk @babylonjs/core
```

## به‌روزرسانی

```bash
npm install @oyna360/lobby-sdk@latest
npm install @oyna360/game-sdk@latest

# یا با pnpm
pnpm update @oyna360/lobby-sdk @oyna360/game-sdk
```

بعد از آپدیت lobby-sdk:

```bash
rm -rf node_modules/.vite
```

نسخهٔ نصب‌شده را چک کنید:

```bash
npm ls @oyna360/lobby-sdk @oyna360/game-sdk
```

## بررسی سلامت `dist`

بعد از نصب، در `node_modules/@oyna360/lobby-sdk/dist/index.js`:

- نباید `from '@platform/lobby-protocol'` دیده شود
- باید فایل‌هایی مثل `platform-lobby.js`, `protocol.js`, `avatar-factory.js` وجود داشته باشد

اگر `index.js` هنوز `@platform/lobby-protocol` import کند، پکیج کهنه است — به آخرین نسخهٔ npm آپدیت کنید.

## جایگزین‌ها (معمولاً لازم نیست)

- **مونوریپو پلتفرم:** استارتر دمو با `workspace:*` از `packages/lobby-sdk` استفاده می‌کند.
- **GitHub:** فقط اگر تگ با `dist` تازه منتشر شده باشد؛ مسیر پیشنهادی برای بازی‌سازان **npm** است.
