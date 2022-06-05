# Integrating ATT Client with Discord.js

You can combine ATT Client with Discord.js to create a bot that communicates between the two. The following example logs in-game player movements to a Discord channel.

```ts
import { Client as AttClient } from 'att-client';
import { Client as DiscordClient } from 'discord.js';
import { attConfig, discordConfig } from './my-configs';

const attBot = new AttClient(attConfig);
const discordBot = new DiscordClient(discordConfig);
const discordChannelId = 12345;

discordBot.on('ready', async () => {
  const channel = await discordBot.channels.fetch(discordChannelId);

  if (!channel) throw new Error('Channel not found!');

  attBot.on('connect', connection => {
    connection.subscribe('PlayerMovedChunk', async message => {
      const { player, newChunk } = message.data;

      channel.send(`${player.username} moved to ${newChunk}.`);
    });
  });
});

attBot.start();
discordBot.login(process.env.DISCORD_BOT_TOKEN);
```
