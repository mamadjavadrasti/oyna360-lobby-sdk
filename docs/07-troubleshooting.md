# عیب‌یابی — Core (`lobby-sdk`)

## `PlatformLobby` is not exported / undefined

از `0.2.0` به بعد `PlatformLobby` در این پکیج نیست:

```bash
npm install @oyna360/lobby-babylon @babylonjs/core
```

```ts
import { PlatformLobby } from '@oyna360/lobby-babylon';
```

## Missing welcome / players خالی

قبل از `connect()` لیسنر `welcome` را ثبت کنید، یا از `LobbyClient.create` → `on` → `connect` استفاده کنید.

## Avatar remote آپدیت نمی‌شود

- سوکت وصل است؟
- سرور `lobby:avatar:update` را می‌پذیرد؟ (نسخه API هم‌تراز)
- URL مطلق ناامن از client strip می‌شود — فقط path نسبی امن forward می‌شود

## dist هنوز Babylon دارد

پکیج کهنه است یا اشتباهی monorepo قدیمی نصب شده. باید فقط `dist/core/**` و `dist/index.js` بدون `@babylonjs` باشد:

```bash
npm install @oyna360/lobby-sdk@^0.2.0
```

## پروتکل drift

در مونوریپو:

```bash
node scripts/sync-lobby-protocol.mjs --check
```
