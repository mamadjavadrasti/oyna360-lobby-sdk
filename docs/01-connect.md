# وصل کردن لابی (Core)

اگر فقط شبکه/state می‌خواهید بدون رندر:

```bash
npm install @oyna360/lobby-sdk
```

```ts
import { LobbyClient } from '@oyna360/lobby-sdk';
const client = LobbyClient.create({ platformInit });
client.on('welcome', () => {});
client.connect();
```

برای لابی ۳D کامل → [`@oyna360/lobby-babylon` docs/01-connect.md](../../lobby-babylon/docs/01-connect.md).

نصب: [02-install.md](./02-install.md)
