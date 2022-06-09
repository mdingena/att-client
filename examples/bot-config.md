# Configuring your first bot

You must provide at least `clientId`, `clientSecret` and `scope`, which are provided to you by Alta when creating your bot account.

```ts
// my-bot-config.js
export const myBotConfig = {
  clientId: 'XXXXXX',
  clientSecret: 'XXXXXX',
  scope: ['XXXXXX', 'XXXXXX', 'XXXXXX']
};
```

```ts
import { Client } from 'att-client';
import { myBotConfig } from './my-bot-config';

const bot = new Client(myBotConfig);

bot.start();
```

## :warning: Storing secrets

You should never share your client ID and secret with anyone! If you're building a bot, be mindful of where you store this information, especially if you'll be committing your source code in an online repository. It's generally best practice to store your secrets in [environment variables](https://www.npmjs.com/package/dotenv), and load them from there:

```ts
// my-bot-config.js
export const myBotConfig = {
  clientId: process.env.CLIENT_ID ?? '',
  clientSecret: process.env.CLIENT_SECRET ?? ''
  // the rest of your configuration...
};
```

## More configuration options

Bots can be configured with more options, such as [restricting it to specific servers](./private-bots.md). Read about [all configuration options](../docs/Config.md) in the documentation.
