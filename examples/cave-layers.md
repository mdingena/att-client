# Display current cave layer

This bot will display the entered cave layer in front of the player for 3 seconds.

```ts
import { Client } from 'att-client';
import { myBotConfig } from './my-bot-config';

const bot = new Client(myBotConfig);

bot.on('connect', connection => {
  connection.subscribe('PlayerMovedChunk', message => {
    const { player, newChunk } = message.data;

    if (newChunk.startsWith('Cave Layer')) {
      connection.send(`player message ${player.id} "${newChunk}" 3`);
    }
  });
});

bot.start();
```
