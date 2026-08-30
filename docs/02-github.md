# انتشار روی GitHub

این پوشه می‌تواند ریپوی جدا برای بازی‌سازان باشد. بازی فقط همین را نصب می‌کند.

**اگر `dist` کهنه پوش شود، دمو داخل مونوریپو درست کار می‌کند و بازی‌ها می‌شکنند** (import به `@platform/lobby-protocol`، بدون انیماتور/برخورد/چت). بعد از هر تغییر SDK حتماً بیلد و پوش کنید.

از روت ریپوی پلتفرم:

```powershell
pnpm.cmd --filter @platform/lobby-sdk build
cd packages/lobby-sdk
# اگر ریپو از قبل هست:
git add dist src docs README.md LICENSE package.json
git commit -m "lobby-sdk: rebuild dist"
git tag v0.1.x
git push origin HEAD
git push origin v0.1.x
```

اولین بار:

```powershell
cd packages/lobby-sdk
pnpm.cmd run build
git init
git add src docs README.md LICENSE package.json tsconfig.json .gitignore dist
git commit -m "oyna360 lobby SDK"
gh repo create mamadjavadrasti/oyna360-lobby-sdk --public --source=. --remote=origin --push
git tag v0.1.0
git push origin v0.1.0
```

بازی باید به **تگ** پین شود، نه شاخهٔ شناور:

```bash
npm install github:mamadjavadrasti/oyna360-lobby-sdk#v0.1.x @babylonjs/core
```

قبل از اعلام به بازی‌ساز، `dist/index.js` را چک کنید: نباید `from '@platform/lobby-protocol'` داشته باشد. باید `humanoid-animator.js` و `lobby-chat-ui.js` در `dist` باشند.

جایگزین امن‌تر برای سرور بازی: کپی همین پوشه (با `dist`) به workspace بازی — بدون وابستگی به GitHub.
