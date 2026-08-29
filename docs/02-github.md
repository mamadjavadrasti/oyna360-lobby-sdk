# انتشار روی GitHub

این پوشه به‌تنهایی یک ریپو است. بازی فقط همین را نصب می‌کند.

از روت ریپوی پلتفرم (یک‌بار):

```powershell
cd packages/lobby-sdk
pnpm.cmd run build
git init
git add src docs README.md LICENSE package.json tsconfig.json .gitignore
git add dist
git commit -m "oyna360 lobby SDK v0.1.0"
gh repo create mamadjavadrasti/oyna360-lobby-sdk --public --source=. --remote=origin --push
git tag v0.1.0
git push origin v0.1.0
```

اگر `dist` را پوش نکنید، بازی‌ساز باید بعد از نصب `tsc` بزند. بهتر است `dist` در ریپوی GitHub باشد.
