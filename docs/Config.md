# `Config`

- [`Config.clientId`](#configclientid)
- [`Config.clientSecret`](#configclientsecret)
- [`Config.console`](#configconsole)
- [`Config.excludedGroups`](#configexcludedgroups)
- [`Config.includedGroups`](#configincludedgroups)
- [`Config.logVerbosity`](#configlogverbosity)
- [`Config.restBaseUrl`](#configrestbaseurl)
- [`Config.scope`](#configscope)
- [`Config.serverConnectionRecoveryDelay`](#configserverconnectionrecoverydelay)
- [`Config.serverHeartbeatTimeout`](#configserverheartbeattimeout)
- [`Config.supportedServerFleets`](#configsupportedserverfleets)
- [`Config.tokenUrl`](#configtokenurl)
- [`Config.webSocketMigrationHandoverPeriod`](#configwebsocketmigrationhandoverperiod)
- [`Config.webSocketMigrationInterval`](#configwebsocketmigrationinterval)
- [`Config.webSocketMigrationRetryDelay`](#configwebsocketmigrationretrydelay)
- [`Config.webSocketPingInterval`](#configwebsocketpinginterval)
- [`Config.webSocketRecoveryRetryDelay`](#configwebsocketrecoveryretrydelay)
- [`Config.webSocketRecoveryTimeout`](#configwebsocketrecoverytimeout)
- [`Config.webSocketRequestAttempts`](#configwebsocketrequestattempts)
- [`Config.webSocketRequestRetryDelay`](#configwebsocketrequestretrydelay)
- [`Config.webSocketUrl`](#configwebsocketurl)
- [`Config.xApiKey`](#configxapikey)

The `Config` object is used to configure a [`Client`](./Client.md).

```ts
interface Config {
  clientId: string;
  clientSecret: string;
  console?: Pick<Console, 'error' | 'warn' | 'info' | 'debug'>;
  excludedGroups?: number[];
  includedGroups?: number[];
  logVerbosity?: Verbosity;
  resubscriptionTimeout?: number;
  restBaseUrl?: string;
  scope: Scope[];
  serverConnectionRecoveryDelay?: number;
  serverHeartbeatTimeout?: number;
  supportedServerFleets: 'att-release' | 'att-quest';
  tokenUrl?: string;
  webSocketMigrationHandoverPeriod?: number;
  webSocketMigrationInterval?: number;
  webSocketMigrationRetryDelay?: number;
  webSocketPingInterval?: number;
  webSocketRecoveryRetryDelay?: number;
  webSocketRequestAttempts?: number;
  webSocketRequestRetryDelay?: number;
  webSocketUrl?: string;
  xApiKey?: string;
}
```

## `Config.clientId`

- `<string>` The bot account's client ID provided to you by Alta.
- :warning: This configuration option is **required**.

This option sets your [`Client`](./Client.md)'s client ID.

## `Config.clientSecret`

- `<string>` The bot account's client secret provided to you by Alta.
- :warning: This configuration option is **required**.
- :warning: Never share your client secret with anyone.

This option sets your [`Client`](./Client.md)'s client secret.

## `Config.console`

- `<Pick<Console, 'error' | 'warn' | 'info' | 'debug'>>` Object with `Console`-like methods `error`, `warn`, `info` and `debug`.
- Defaults to your current environment's `console`.

This option is useful if you have a custom logging setup and you wish to integrate it with [`Client`](./Client.md).

```ts
const myConsoleLike = new MyCustomLogger();

config.console = myConsoleLike;

const client = new Client(config);
```

## `Config.excludedGroups`

- `<number[]>` Array of server group IDs.
- :warning: Ignored if `Config.includedGroups` is also configured.
- Defaults to `[]`, which means **no groups** are excluded.

This option allows you to prevent your [`Client`](./Client.md) from executing its logic on the listed groups and any servers of those groups.

## `Config.includedGroups`

- `<number[]>` Array of server group IDs.
- Defaults to `[]`, which means **all groups** are included.

This option allows you to restrict your [`Client`](./Client.md) to only execute its logic on the listed groups and all their servers.

## `Config.logVerbosity`

- `<Verbosity>` Number between 0 and 4 (inclusive).
- Defaults to `2` (only errors and warnings).

```ts
enum Verbosity {
  Quiet = 0,
  Error = 1,
  Warning = 2,
  Info = 3,
  Debug = 4
}
```

This option changes logging behaviour. The higher `logVerbosity`, the more verbose logging becomes.

:warning: `Debug` verbosity is not recommended for regular operation.

## `Config.restBaseUrl`

- `<string>` Base URL of the REST API.
- Defaults to `'https://967phuchye.execute-api.ap-southeast-2.amazonaws.com/prod/api'`.

This options allows you to change where [`Api`](./Api.md) sends its requests.

:warning: It's not recommended that you change this option.

## `Config.scope`

- `<Scope[]>` Array of `<Scope>` strings.
- :warning: This configuration option is **required**.

```ts
type Scope =
  | 'group.info'
  | 'group.invite'
  | 'group.join'
  | 'group.leave'
  | 'group.members'
  | 'group.view'
  | 'server.console'
  | 'server.view'
  | 'ws.group'
  | 'ws.group_bans'
  | 'ws.group_invites'
  | 'ws.group_members'
  | 'ws.group_servers';
```

This option sets your [`Client`](./Client.md)'s scope. This option should match the scope that is associated with the client ID and is provided to you by Alta.

## `Config.serverHeartbeatTimeout`

- `<number>` Time in milliseconds.
- Defaults to 10 minutes.

This option configures how long a server with an idle console connection is to be considered "online". When this timeout expires, the console connection will be closed.

## `Config.serverConnectionRecoveryDelay`

- `<number>` Time in milliseconds.
- Defaults to 10 seconds.

This option configures how long to wait after a server console connection closed unexpectedly before recovering the connection.

## `Config.supportedServerFleets`

- `<ServerFleet[]>` Array of `<ServerFleet>` strings.
- Defaults to `['att-release', 'att-quest']`.

This option configures which types of servers your [`Client`](./Client.md) will make a console connection to. By default, both `'att-release'` (PCVR) and `'att-quest'` (Meta Quest) server fleets are supported. This option is useful when you're sending commands to game servers that are only available on a particular server fleet. For example, Quest servers do not support `select` and `spawn` command modules, so you can prevent your Client from connecting to these servers by restricting it to PCVR only.

Alternatively, you can let Client connect to all server fleets and handle your decision making logic in the console connection:

```ts
client.on('connect', connection => {
  if (connection.server.fleet === 'att-quest') {
    console.log('This client does not support Quest servers.');
    connection.disconnect();
  }
  /* ... */
});
```

## `Config.tokenUrl`

- `<string>` URL to JWT endpoint.
- Defaults to `'https://accounts.townshiptale.com/connect/token'`.

This options allows you to change where [`Client`](./Client.md) retrieves its JWT.

:warning: It's not recommended that you change this option.

## `Config.webSocketMigrationHandoverPeriod`

- `<number>` Time in milliseconds.
- Defaults to 10 seconds.

This option configures how long [`Client`](./Client.md) keeps an old WebSocket open after a successor WebSocket has been created and all subscriptions have been migrated. This acts as a grace period for any in-flight messages.

## `Config.webSocketMigrationInterval`

- `<number>` Time in milliseconds.
- Defaults to 110 minutes.

This option configures the time period between WebSocket migrations. Alta use AWS WebSockets, which have a maximum lifespan of 120 minutes.

## `Config.webSocketMigrationRetryDelay`

- `<number>` Time in milliseconds.
- Defaults to 10 seconds.

This option configures the delay before a failed WebSocket migration is retried.

## `Config.webSocketPingInterval`

- `<number>` Time in milliseconds.
- Defaults to 5 minutes.

This option configures the time period between WebSocket ping requests. These pings are necessary to keep the WebSocket connection open when there is no other traffic. Alta use AWS WebSockets, which close their connections after 10 minutes of inactivity.

## `Config.webSocketRecoveryRetryDelay`

- `<number>` Time in milliseconds.
- Defaults to 5 seconds.

This option configures the delay before retrying failed WebSocket recovery.

## `Config.webSocketRecoveryTimeout`

- `<number>` Time in milliseconds.
- Defaults to 2 minutes.

This option configures how long recovering WebSocket subscriptions is allowed to take. When this timeout expires, a new WebSocket will be created.

## `Config.webSocketRequestAttempts`

- `<number>` Amount of request attempts.
- Defaults to 3 attempts.

This option configures the number of times [`Client`](./Client.md) will attempt to send a WebSocket request.

## `Config.webSocketRequestRetryDelay`

- `<number>` Time in milliseconds.
- Defaults to 3 seconds.

This option configures the delay before retrying failed WebSocket requests.

## `Config.webSocketUrl`

- `<string>` URL to bot account WebSocket.
- Defaults to `'wss://5wx2mgoj95.execute-api.ap-southeast-2.amazonaws.com/dev'`.

This options allows you to change where [`Subscriptions`](./Subscriptions.md) sends its messages.

:warning: It's not recommended that you change this option.

## `Config.xApiKey`

- `<string>` Authorisation key for the REST API.
- Defaults to `'2l6aQGoNes8EHb94qMhqQ5m2iaiOM9666oDTPORf'`.

This options allows you to change the authorisation key that [`Api`](./Api.md) uses.

:warning: It's not recommended that you change this option.
