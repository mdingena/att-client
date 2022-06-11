# `Config`

- [`Config.clientId`](#configclientid)
- [`Config.clientSecret`](#configclientsecret)
- [`Config.console`](#configconsole)
- [`Config.excludedGroups`](#configexcludedgroups)
- [`Config.includedGroups`](#configincludedgroups)
- [`Config.logVerbosity`](#configlogverbosity)
- [`Config.restBaseUrl`](#configrestbaseurl)
- [`Config.scope`](#configscope)
- [`Config.serverHeartbeatTimeout`](#configserverheartbeattimeout)
- [`Config.tokenUrl`](#configtokenurl)
- [`Config.webSocketMigrationHandoverPeriod`](#configwebsocketmigrationhandoverperiod)
- [`Config.webSocketMigrationInterval`](#configwebsocketmigrationinterval)
- [`Config.webSocketMigrationRetryDelay`](#configwebsocketmigrationretrydelay)
- [`Config.webSocketPingInterval`](#configwebsocketpinginterval)
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
  restBaseUrl?: string;
  scope: Scope[];
  serverHeartbeatTimeout?: number;
  tokenUrl?: string;
  webSocketMigrationHandoverPeriod?: number;
  webSocketMigrationInterval?: number;
  webSocketPingInterval?: number;
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

## `Config.tokenUrl`

- `<string>` URL to JWT endpoint.
- Defaults to `https://accounts.townshiptale.com/connect/token'`.

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

This option configured the time period between WebSocket ping requests. These pings are necessary to keep the WebSocket connection open when there is no other traffic. Alta use AWS WebSockets, which close their connections after 10 minutes of inactivity.

## `Config.webSocketUrl`

- `<string>` URL to bot account WebSocket.
- Defaults to `wss://5wx2mgoj95.execute-api.ap-southeast-2.amazonaws.com/dev'`.

This options allows you to change where [`Subscriptions`](./Subscriptions.md) sends its messages.

:warning: It's not recommended that you change this option.

## `Config.xApiKey`

- `<string>` Authorisation key for the REST API.
- Defaults to `'2l6aQGoNes8EHb94qMhqQ5m2iaiOM9666oDTPORf'`.

This options allows you to change the authorisation key that [`Api`](./Api.md) uses.

:warning: It's not recommended that you change this option.
