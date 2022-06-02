import { Client } from './src/Client';
import { Verbosity } from './src/Logger';

const client = new Client({
  clientId: process.env['ALTA_CLIENT_ID'] ?? '',
  clientSecret: process.env['ALTA_CLIENT_SECRET'] ?? '',
  scope: [
    'group.info',
    'group.invite',
    'group.join',
    'group.leave',
    'group.members',
    'group.view',
    'server.console',
    'server.view',
    'ws.group',
    'ws.group_bans',
    'ws.group_invites',
    'ws.group_members',
    'ws.group_servers'
  ],
  logVerbosity: Verbosity.Debug
});

client.on('connect', connection => {
  connection.subscribe('PlayerMovedChunk', message => {
    const {
      player: { id },
      newChunk
    } = message.data;

    console.log(`${id} moved to ${newChunk}.`);
  });
});

client.start();
