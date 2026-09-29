# نصب از GitHub (اختیاری)

> **پیشنهاد:** از npm نصب کنید — [02-install.md](./02-install.md) (`^0.2.0`).

اگر لازم شد از ریپوی عمومی نصب کنید:

`https://github.com/mamadjavadrasti/oyna360-lobby-sdk`

از `0.2.0` دو پکیج جدا هستند — برای لابی ۳D معمولاً `@oyna360/lobby-babylon` از npm کافی است.

```bash
# فقط Core
npm install github:mamadjavadrasti/oyna360-lobby-sdk#v0.2.0

# لابی ۳D — ترجیح با npm:
npm install @oyna360/lobby-babylon@^0.2.0 @babylonjs/core
```

تگ باید شامل `dist/` بیلدشده برای هر پکیج باشد. برای مسیر عادی، همان سند npm را ببینید.
