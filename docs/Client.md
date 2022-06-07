# Class: `Client`

- [`new Client(config)`](#new-clientconfig)
- [`client.accessToken`](#clientaccesstoken)
- [`client.api`](#clientapi)
- [`client.config`](#clientconfig)
- [`client.groups`](#clientgroups)
- [`client.logger`](#clientlogger)
- [`client.start()`](#clientstart)
- [`client.subscriptions`](#clientsubscriptions)
- [Event: `'connect'`](#event-connect)
- [Event: `'ready'`](#event-ready)

## `new Client(config)`

- `config` [`<Config>`](./Config.md) The configuration to use when initialising the client.

Creates a new `Client` object configured with the passed in configuration.

```ts
import { Client } from 'att-client';
import { myClientConfig } from './my-client-config';

const client = new Client(myClientConfig);
```

## `client.accessToken`

Gets the current JWT access token that `Client` has obtained from Alta. Returns `undefined` when accessed before running [`client.start()`](#clientstart). `Client` automatically refreshes the access token after 90% of the token's lifespan has expired.

The access token is required for all communication with authenticated REST API endpoints.

```ts
if (typeof client.accessToken === 'undefined') {
  throw new Error('Invalid access token. Did you client.start()?');
}

const headers = new Headers({
  Authorization: `Bearer ${client.accessToken}`
});
```

## `client.api`

Gets a reference to `Client`'s configured [`Api`](./Api.md) instance, which allows for easy querying of Alta's REST API using `Api`'s helper methods.

```ts
const groupId = 12345;
const response = await client.api.getGroupInfo(groupId);

if (typeof response === 'undefined') throw new Error('Something went wrong');

console.log(response);
// => {
//   id: 12345
//   name: 'My Friends',
//   description: 'Group for me and my friends.',
//   member_count: 42,
//   created_at: '2022-02-22T22:22:22.222Z'
//   type: 'Normal',
//   tags: ['Modded'],
//   servers: {
//     id: 98765,
//     name: 'My Friends',
//     scene_index: 0,
//     status: 'Online'
//   },
//   allowed_server_count: 1,
//   roles: [
//     {
//       role_id: 1,
//       name: 'Member',
//       color: '#FFFFFF',
//       permissions: ['Invite'],
//       allowed_commands: []
//     },
//     {
//       role_id: 2,
//       name: 'Moderator',
//       color: '#FFFF00',
//       permissions: ['Invite', 'Console'],
//       allowed_commands: []
//     },
//     {
//       role_id: 7,
//       name: 'Owner',
//       color: '#FF0000',
//       permissions: ['Invite', 'Console'],
//       allowed_commands: []
//     }
//   ]
// }
```

## `client.config`

Gets `Client`'s configuration. It is not recommended to change any configuration options at runtime.

```ts
new WebSocket(client.config.webSocketUrl);
```

## `client.groups`

Gets all of `Client`'s managed groups. The object it provides can be used to access information about each [`Group`](./Group.md).

```ts
const groupId = 12345;
const myGroup = client.groups[groupId];

console.log(`My group is called ${group.name}`);

for (const group of Object.values(client.groups)) {
  console.log(group.name);
  // Logs all managed groups' names.
}
```

## `client.logger`

Gets the configured `Logger` instance, which is used internally to consistently log information at the configured `logVerbosity`.

```ts
// With default client.config.logVerbosity
client.logger.error('This error message will be logged.');
client.logger.warn('This warning message will also be logged.');
client.logger.info('This info message will NOT be logged due to logVerbosity.');
client.logger.debug('This debug message will NOT be logged due to logVerbosity.');
```

## `client.start()`

- Returns: `Promise<void>`

Launches the client, connecting it to the configured REST API, WebSocket, and subscribing to and handling group and server events.

```ts
await client.start();

console.log('Finished!');
// Will log 'Finished!' only after client has finished starting sequence.
```

## `client.subscriptions`

Gets a reference to `Client`'s configured [`Subscriptions`](./Subscriptions.md) instance, which allows for easy messaging on Alta's WebSocket using `Subscriptions`'s helper methods.

```ts
await client.subscriptions.subscribe('group-update', message => {
  console.log(`New details for ${message.content.name}.`);
  // Logs every time a group's details are updated.
});
```

## Event: `'connect'`

The `'connect'` event is emitted every time `Client` connects to an ATT game server's console WebSocket. The listener callback is passed is passed a single [`ServerConnection`](./ServerConnection.md) argument when called.

```ts
client.on('connect', connection => {
  console.log(`Console connection established to ${connection.server.name}.`);
  // Will log every time Client connect to a game server.
});
```

## Event: `'ready'`

The `'ready'` event is emitted after `Client` successfully finishes its launching sequence (see [`client.start()`](#clientstart)). The listener callback is not passed any arguments when called.

This event _should_ only be emitted once per `Client`, as [`client.start()`](#clientstart) cannot be called multiple times.

```ts
client.once('ready', () => {
  console.log('Finished!');
  // Will log 'Finished!' only after client has finished starting sequence.
});
```
