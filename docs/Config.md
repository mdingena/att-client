# `Config`

- [`Config.apiRequestAttempts`](#configapirequestattempts)
- [`Config.apiRequestRetryDelay`](#configapirequestretrydelay)
- [`Config.apiRequestTimeout`](#configapirequesttimeout)
- [`Config.clientId`](#configclientid)
- [`Config.clientSecret`](#configclientsecret)
- [`Config.console`](#configconsole)
- [`Config.excludedGroups`](#configexcludedgroups)
- [`Config.includedGroups`](#configincludedgroups)
- [`Config.logPrefix`](#configlogprefix)
- [`Config.logVerbosity`](#configlogverbosity)
- [`Config.maxMissedServerHeartbeats`](#configmaxmissedserverheartbeats)
- [`Config.maxSubscriptionsPerWebSocket`](#configmaxsubscriptionsperwebsocket)
- [`Config.maxWorkerConcurrency`](#configmaxworkerconcurrency)
- [`Config.password`](#configpassword)
- [`Config.restBaseUrl`](#configrestbaseurl)
- [`Config.scope`](#configscope)
- [`Config.serverConnectionRecoveryDelay`](#configserverconnectionrecoverydelay)
- [`Config.serverHeartbeatInterval`](#configserverheartbeatinterval)
- [`Config.supportedServerFleets`](#configsupportedserverfleets)
- [`Config.tokenUrl`](#configtokenurl)
- [`Config.username`](#configusername)
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
interface CommonConfig {
  apiRequestAttempts?: number;
  apiRequestRetryDelay?: number;
  apiRequestTimeout?: number;
  console?: Pick<Console, 'error' | 'warn' | 'info' | 'debug'>;
  excludedGroups?: number[];
  includedGroups?: number[];
  logPrefix?: string;
  logVerbosity?: Verbosity;
  maxMissedServerHeartbeats?: number;
  maxSubscriptionsPerWebsocket?: number;
  maxWorkerConcurrency?: number;
  restBaseUrl?: string;
  serverConnectionRecoveryDelay?: number;
  serverHeartbeatTimeout?: number;
  supportedServerFleets?: 'att-release' | 'att-quest';
  tokenUrl?: string;
  webSocketMigrationHandoverPeriod?: number;
  webSocketMigrationInterval?: number;
  webSocketMigrationRetryDelay?: number;
  webSocketPingInterval?: number;
  webSocketRecoveryRetryDelay?: number;
  webSocketRecoveryTimeout?: number;
  webSocketRequestAttempts?: number;
  webSocketRequestRetryDelay?: number;
  webSocketUrl?: string;
  xApiKey?: string;
}

interface BotConfig extends CommonConfig {
  clientId: string;
  clientSecret: string;
  scope: Scope[];
}

interface UserConfig extends CommonConfig {
  username: string;
  password: string;
}

type Config = BotConfig | UserConfig;
```

## `Config.apiRequestAttempts`

- `<number>` Amount of request attempts.
- Defaults to 3 attempts.

This option configures the number of times [`Client`](./Client.md) will attempt to send an API request.

## `Config.apiRequestRetryDelay`

- `<number>` Time in milliseconds.
- Defaults to 3 seconds.

This option configures the delay before a failed API request is retried.

## `Config.apiRequestTimeout`

- `<number>` Time in milliseconds.
- Defaults to 5 seconds.

This option configures how API requests are allowed to take.

## `Config.clientId`

- `<string>` A bot account's client ID provided to you by Alta.
- :warning: This configuration option is **required** for bot automation.
- :warning: This configuration option and [`Config.username`](#configusername) are **mutually exclusive**.

This option sets your [`Client`](./Client.md)'s client ID.

## `Config.clientSecret`

- `<string>` A bot account's client secret provided to you by Alta.
- :warning: This configuration option is **required** for bot automation.
- :warning: This configuration option and [`Config.password`](#configpassword) are **mutually exclusive**.
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

## `Config.logPrefix`

- `<string>` The text you want to use to prefix logs from the client.
- Defaults to `[att-client]`.

This option helps you differentiate att-client logs with your other application logs.

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

## `Config.maxMissedServerHeartbeats`

- `<number>` Number of allowed missed server heartbeats.
- Defaults to 3.

When a server has missed this number of expected `heartbeat` WebSocket events, the server is considered to be offline and the console connection will be closed.

## `Config.maxSubscriptionsPerWebSocket`

- `<number>` Number of subscriptions per WebSocket instance.
- Defaults to `500`.

This option configures how many subscriptions are bundled per `Subscriptions` instance. When this number of subscriptions is reach on an instance, the next subscription will cause the `SubscriptionsManager` to first create a new `Subscriptions` instance to handle the new subscription.

:warning: It's not recommended that you change this option. It's been proven that setting this too high can lead to WebSocket migration errors, causing dropped subscriptions and loss of your bot's responsiveness.

## `Config.maxWorkerConcurrency`

- `<number>` Number of concurrent workers handling requests.
- Defaults to `25`.

This option configures how many workers are available to handle requests made to Alta services.

:warning: It's not recommended that you change this option. It's been proven that setting this too high will overwhelm Alta services and destabilise your [`Client`](./Client.md)'s connection.

## `Config.password`

- `<string>` An Alta account's password or its SHA512 hexadecimal hash (**preferred**).
- :warning: This configuration option is **required** when not using [`Config.clientSecret`](#configclientsecret).
- :warning: This configuration option and [`Config.clientSecret`](#configclientsecret) are **mutually exclusive**.
- :warning: Never share your account password with anyone.

This option allows [`Client`](./Client.md) to impersonate a user account when interacting with Alta services.

:warning: Most bot automation features are **disabled** when configuring user credentials.

## `Config.restBaseUrl`

- `<string>` Base URL of the REST API.
- Defaults to `'https://webapi.townshiptale.com'`.

This option allows you to change where [`Api`](./Api.md) sends its requests.

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

## `Config.serverHeartbeatInterval`

- `<number>` Time in milliseconds.
- Defaults to 20 seconds.

This option configures how long to wait for a server's `heartbeat` WebSocket event. `heartbeat` events are expected to arrive every 15 seconds while a server is online, giving the server a 5-second grace period by default. If you want to change this option, it is not recommended that you set it lower than 15 seconds.

:warning: It's not recommended that you change this option.

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

This option allows you to change where [`Client`](./Client.md) retrieves its JWT.

:warning: It's not recommended that you change this option.

## `Config.username`

- `<string>` An Alta account's username.
- :warning: This configuration option is **required** when not using [`Config.clientId`](#configclientid).
- :warning: This configuration option and [`Config.clientId`](#configclientid) are **mutually exclusive**.

This option allows [`Client`](./Client.md) to impersonate a user account when interacting with Alta services.

:warning: Most bot automation features are **disabled** when configuring user credentials.

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
- Defaults to `'wss://websocket.townshiptale.com'`.

This option allows you to change where [`Subscriptions`](./Subscriptions.md) sends its messages.

:warning: It's not recommended that you change this option.

## `Config.xApiKey`

- `<string>` Authorisation key for the REST API.
- Defaults to `'2l6aQGoNes8EHb94qMhqQ5m2iaiOM9666oDTPORf'`.

This option allows you to change the authorisation key that [`Api`](./Api.md) uses.

:warning: It's not recommended that you change this option.
