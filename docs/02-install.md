# نصب و انتشار (npm) — Core + Babylon

از **`0.2.0`** دو پکیج جدا دارید:

| پکیج | نقش | npm |
|------|-----|-----|
| `@oyna360/lobby-sdk` | Core (شبکه / state) | [`npm`](https://www.npmjs.com/package/@oyna360/lobby-sdk) `^0.2.0` |
| `@oyna360/lobby-babylon` | رندر Babylon / `PlatformLobby` | [`npm`](https://www.npmjs.com/package/@oyna360/lobby-babylon) `^0.2.0` |
| `@oyna360/game-sdk` | هویت / سشن | [`npm`](https://www.npmjs.com/package/@oyna360/game-sdk) |

---

## نصب برای بازی ۳D (معمول)

```bash
npm install @oyna360/lobby-babylon @babylonjs/core
# یا
pnpm add @oyna360/lobby-babylon @babylonjs/core
```

```json
{
  "dependencies": {
    "@oyna360/lobby-babylon": "^0.2.0",
    "@babylonjs/core": "^7.44.0"
  }
}
```

`lobby-sdk` به‌صورت dependency از `lobby-babylon` می‌آید.

## فقط Core (بدون Babylon)

```bash
npm install @oyna360/lobby-sdk
```

## نصب همراه game-sdk

```bash
npm install @oyna360/game-sdk @oyna360/lobby-babylon @babylonjs/core
```

## به‌روزرسانی

```bash
npm install @oyna360/lobby-babylon@latest @oyna360/lobby-sdk@latest
rm -rf node_modules/.vite
npm ls @oyna360/lobby-babylon @oyna360/lobby-sdk
```

## بررسی سلامت `dist`

### Core — `node_modules/@oyna360/lobby-sdk/dist`

- نباید `from '@platform/lobby-protocol'` باشد
- نباید import از `@babylonjs/*` باشد
- باید `core/lobby-client.js`, `core/protocol.js`, `core/avatar-state.js` وجود داشته باشد
- **نباید** `platform-lobby.js` / `avatar-factory.js` در ریشهٔ dist باشد (آن‌ها در babylon هستند)

### Babylon — `node_modules/@oyna360/lobby-babylon/dist`

- باید `platform-lobby.js`, `avatar-factory.js` وجود داشته باشد
- dependency به `@oyna360/lobby-sdk` resolve شده باشد

## Migration از ≤ 0.1.x

```diff
- "@oyna360/lobby-sdk": "^0.1.3"
+ "@oyna360/lobby-babylon": "^0.2.0"

- import { PlatformLobby } from '@oyna360/lobby-sdk'
+ import { PlatformLobby } from '@oyna360/lobby-babylon'
```

---

## انتشار به npm (نگهدارندگان مونوریپو)

ترتیب مهم است — اول Core:

```bash
# از روت پلتفرم
pnpm --filter @oyna360/lobby-sdk build
pnpm --filter @oyna360/lobby-babylon build

cd packages/lobby-sdk
npm publish --access public

cd ../lobby-babylon
npm publish --access public
```

نسخهٔ هر دو پکیج باید هم‌تراز باشد (مثلاً `0.2.0`).  
در `lobby-babylon/package.json` dependency روی Core باید نسخهٔ npm باشد (`^0.2.0`)، نه `file:`.

اختیاری — pack بدون publish:

```bash
pnpm lobby:pack
# یا
node scripts/lobby-sdk-pack.mjs --tarball
```

## مونوریپو

استارتر دمو: `workspace:*` روی هر دو پکیج (`apps/examples/lobby-demo`).
