# حالت‌های اجرا

## 1) Production — iframe پلتفرم

```text
بازیکن → /play/{slug} → iframe بازی → game-sdk init → lobby-sdk
```

- سشن توسط پلتفرم ساخته می‌شود.
- `platform:init` شامل `avatar` و `lobby` است.
- امتیاز/جِم بعداً از game-sdk در iframe در دسترس است.

```ts
await PlatformSDK.init();
const lobby = await PlatformLobby.create({
  canvas,
  platformInit: PlatformSDK.getInitPayload()!,
  roomId: PlatformSDK.getInitPayload()!.lobby!.roomId,
  wsUrl: PlatformSDK.getInitPayload()!.lobby!.wsUrl,
});
```

---

## 2) Developer Environment — بدون iframe (توصیه‌شده)

```text
npm run dev → game-sdk + Dev Credential → POST /dev/gateway/session → lobby-sdk → WS واقعی
```

1. در `/developer` یک Dev Project و Credential بسازید (بدون Catalog).
2. `PlatformSDK.init({ platformUrl, platformWebUrl, dev: { clientId, credential } })`.
3. همان `PlatformLobby.create({ platformInit })` — Lobby SDK از auth خبر ندارد.

`createDev()` را اینجا استفاده نکنید.

جزئیات: مستندات game-sdk → `10-developer-environment.md`.

---

## 2b) Direct Development (legacy / slug) — بدون iframe

```text
npm run dev → origin شما → game-sdk Authorize → Context واقعی → lobby-sdk → WS واقعی
```

مناسب وقتی پلتفرم را لوکال ندارید ولی سرور oyna360 در دسترس است.

1. game-sdk را طبق [09-direct-development](../../game-sdk/docs/09-direct-development.md) تنظیم کنید.
2. همان `PlatformLobby.create({ platformInit })`.
3. Origin توسعه را allowlist کنید.

`createDev()` را اینجا استفاده نکنید.

---

## 3) `createDev()` — Fake / Offline

```ts
await PlatformLobby.createDev({
  canvas,
  roomId: 'game:my-game',
  config: { enableMultiplayer: false },
  mockUser: { displayName: 'Tester' },
});
```

- سشن ساختگی (`dev-token`) — سرور لابی آن را برای مالتی‌پلیر واقعی قبول نمی‌کند.
- برای چیدمان صحنه، UI، پورتال بدون شبکه.
- با Direct Development اشتباه نشود.

---

## مقایسه سریع

| | Production | Direct Dev | createDev |
|--|:----------:|:----------:|:---------:|
| اکانت واقعی | ✅ | ✅ | ❌ |
| سشن واقعی | ✅ | ✅ | ❌ |
| remote players | ✅ | ✅ | ❌ |
| نیاز به پلتفرم لوکال | نه* | نه | نه |
| نیاز به iframe | ✅ | ❌ | ❌ |

\* مگر خودتان همه stack را لوکال بالا آورده باشید.

بعدی: [04-api.md](./04-api.md)
