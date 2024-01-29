import type { GroupInfo, GroupMemberInfo } from '../Api/schemas/index.js';
import type { Config } from './Config.js';
import type { Server } from '../Server/index.js';
import type { ServerConnection } from '../ServerConnection/index.js';
import { createHash } from 'node:crypto';
import { TypedEmitter } from '@mdingena/tiny-typed-emitter';
import jwtDecode from 'jwt-decode';
import { Api, DecodedToken, Endpoint } from '../Api/index.js';
import { Group } from '../Group/index.js';
import { Logger, Verbosity } from '../Logger/index.js';
import { Workers } from '../Workers/index.js';
import { AGENT, DEFAULTS, MAX_WORKER_CONCURRENCY_WARNING } from '../constants.js';
import { SubscriptionsManager } from '../SubscriptionsManager/SubscriptionsManager.js';

interface Events {
  connect: (serverConnection: ServerConnection) => void;
  ready: () => void;
}

type Groups = Record<number, Group>;

enum ReadyState {
  Stopped,
  Starting,
  Ready
}

export class Client extends TypedEmitter<Events> {
  accessToken?: string;
  api: Api;
  config: Required<Config>;
  groups: Groups;
  logger: Logger;
  name: string;
  subscriptions: SubscriptionsManager;

  private decodedToken?: DecodedToken;
  private readyState: ReadyState;
  private refreshTokensDelay?: NodeJS.Timeout;

  constructor(config: Config) {
    super();

    /* Configure logging console. */
    const configuredConsole = config.console ?? DEFAULTS.console;

    /* Configure log verbosity. */
    if (typeof config.logVerbosity === 'undefined') {
      configuredConsole.warn(
        "Using Warning log verbosity. You will only see Errors and Warnings. If you want to see more verbose logs, create your client with a higher 'logVerbosity'."
      );
    } else if (config.logVerbosity >= Verbosity.Debug) {
      configuredConsole.warn(
        'You are using Debug log verbosity. This is not recommended for production environments as sensitive information like configured credentials will appear in your logs. Please consider using Info log verbosity or lower for production.'
      );
    }

    const configuredLogVerbosity = config.logVerbosity ?? DEFAULTS.logVerbosity;

    /* Create logger. */
    this.logger = new Logger(configuredLogVerbosity, configuredConsole);
    this.logger.info('Configuring client.');

    /* Validate required configuration. */
    if ('clientId' in config) {
      if (
        typeof config.clientId === 'undefined' ||
        typeof config.clientSecret === 'undefined' ||
        typeof config.scope === 'undefined'
      ) {
        this.logger.error("Cannot create bot client without 'clientId', 'clientSecret', and 'scope'.");
        throw new Error('Invalid client configuration.');
      }
    } else if ('username' in config) {
      if (typeof config.username === 'undefined' || typeof config.password === 'undefined') {
        this.logger.error("Cannot create user client without 'username' and 'password'.");
        throw new Error('Invalid client configuration.');
      }
    } else {
      this.logger.error('Cannot create client without either bot credentials or user credentials.');
      throw new Error('Invalid client configuration.');
    }

    /* Validate optional configuration. */
    if (
      typeof config.excludedGroups !== 'undefined' &&
      config.excludedGroups.length > 0 &&
      typeof config.includedGroups !== 'undefined' &&
      config.includedGroups.length > 0
    ) {
      this.logger.warn('Client configuration contains both included and excluded groups. Ignoring excluded groups.');
    }

    if (
      typeof config.maxWorkerConcurrency !== 'undefined' &&
      config.maxWorkerConcurrency > MAX_WORKER_CONCURRENCY_WARNING
    ) {
      this.logger.warn(
        'Maximum concurrency is set above recommended level. Client may experience issues with WebSocket migrations as a result of too many concurrent requests.'
      );
    }

    /* Save configuration. */
    const credentials =
      'clientId' in config
        ? {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            scope: config.scope
          }
        : {
            username: config.username,
            password: config.password
          };

    this.config = {
      ...credentials,
      console: configuredConsole,
      excludedGroups:
        config.excludedGroups && (typeof config.includedGroups === 'undefined' || config.includedGroups.length === 0)
          ? config.excludedGroups
          : DEFAULTS.excludedGroups,
      includedGroups: config.includedGroups ?? DEFAULTS.includedGroups,
      logVerbosity: configuredLogVerbosity,
      maxWorkerConcurrency: config.maxWorkerConcurrency ?? DEFAULTS.maxWorkerConcurrency,
      maxSubscriptionsPerWebSocket: config.maxSubscriptionsPerWebSocket ?? DEFAULTS.maxSubscriptionsPerWebSocket,
      restBaseUrl: config.restBaseUrl ?? DEFAULTS.restBaseUrl,
      serverConnectionRecoveryDelay: config.serverConnectionRecoveryDelay ?? DEFAULTS.serverConnectionRecoveryDelay,
      serverHeartbeatTimeout: config.serverHeartbeatTimeout ?? DEFAULTS.serverHeartbeatTimeout,
      supportedServerFleets: config.supportedServerFleets ?? DEFAULTS.supportedServerFleets,
      tokenUrl: config.tokenUrl ?? DEFAULTS.tokenUrl,
      webSocketMigrationHandoverPeriod:
        config.webSocketMigrationHandoverPeriod ?? DEFAULTS.webSocketMigrationHandoverPeriod,
      webSocketMigrationInterval: config.webSocketMigrationInterval ?? DEFAULTS.webSocketMigrationInterval,
      webSocketMigrationRetryDelay: config.webSocketMigrationRetryDelay ?? DEFAULTS.webSocketMigrationRetryDelay,
      webSocketPingInterval: config.webSocketPingInterval ?? DEFAULTS.webSocketPingInterval,
      webSocketRecoveryRetryDelay: config.webSocketRecoveryRetryDelay ?? DEFAULTS.webSocketRecoveryRetryDelay,
      webSocketRecoveryTimeout: config.webSocketRecoveryTimeout ?? DEFAULTS.webSocketRecoveryTimeout,
      webSocketRequestAttempts: config.webSocketRequestAttempts ?? DEFAULTS.webSocketRequestAttempts,
      webSocketRequestRetryDelay: config.webSocketRequestRetryDelay ?? DEFAULTS.webSocketRequestRetryDelay,
      webSocketUrl: config.webSocketUrl ?? DEFAULTS.webSocketUrl,
      xApiKey: config.xApiKey ?? DEFAULTS.xApiKey
    };

    /* Initialise internals. */
    this.api = new Api(this);
    this.groups = {};
    this.name = `${AGENT.name} v${AGENT.version}`;
    this.readyState = ReadyState.Stopped;
    this.subscriptions = new SubscriptionsManager(this);
  }

  /**
   * Launches the client. Connects to Alta API and WebSocket, and subscribes
   * to events for account management. Keeps track of managed groups and
   * servers.
   */
  async start() {
    if (this.readyState !== ReadyState.Stopped) {
      this.logger.error('This client is already initialised.');
      return;
    }

    this.readyState = ReadyState.Starting;
    this.logger.info('Initialising client.');

    /* Configure access token and decoded token. */
    const decodedToken = await this.refreshTokens();

    /* Handle bot automation. */
    if ('client_sub' in decodedToken) {
      const userId = decodedToken.client_sub;

      try {
        /* Subscribe to account messages. */
        this.logger.debug('Subscribing to account messages.');

        await Promise.allSettled([
          /* Subscribe to and handle server group invitation message. */
          this.subscriptions.subscribe('me-group-invite-create', userId, message => {
            try {
              const { id, name } = message.content;

              this.logger.info(`Accepting invite to group ${id} (${name})`);
              this.api.acceptGroupInvite(id);
            } catch (error) {
              this.logger.error(`Error while handling group invite: ${(error as Error).message}`);
            }
          }),

          /* Subscribe to and handle server group joined message. */
          this.subscriptions.subscribe('me-group-create', userId, async message => {
            try {
              const { group, member } = message.content;

              this.logger.info(`Client was added to group ${group.id} (${group.name}).`);

              /* Create a new managed group. */
              this.addGroup(group, member);
            } catch (error) {
              this.logger.error(`Error while joining group: ${(error as Error).message}`);
            }
          }),

          /* Subscribe to and handle server group left message. */
          this.subscriptions.subscribe('me-group-delete', userId, message => {
            try {
              const groupId = message.content.group.id;
              const groupName = message.content.group.name;

              this.logger.info(`Client was removed from group ${groupId} (${groupName}).`);
              this.removeGroup(groupId);
            } catch (error) {
              this.logger.error(`Error while leaving group: ${(error as Error).message}`);
            }
          })
        ]);

        /* Manage all joined groups. */
        const joinedGroups = await this.api.getJoinedGroups();

        if (joinedGroups.length > 0) {
          this.logger.info(`Managing ${joinedGroups.length} group${joinedGroups.length > 1 ? 's' : ''}.`);

          const tasks = joinedGroups.map(
            ({ group, member }) =>
              () =>
                this.addGroup(group, member)
          );

          const workers = new Workers(this.config.maxWorkerConcurrency);
          await workers.do(tasks);
        }

        /* Accept pending group invites. */
        const invites = await this.api.getPendingGroupInvites();

        if (invites.length > 0) {
          this.logger.info(`Accepting ${invites.length} pending group invite${invites.length > 1 ? 's' : ''}.`);

          const tasks = invites.map(invite => () => this.api.acceptGroupInvite(invite.id));

          const workers = new Workers(this.config.maxWorkerConcurrency);
          await workers.do(tasks);
        }
      } catch (error) {
        this.logger.error((error as Error).message);
        return;
      }
    } else {
      this.logger.warn(
        `You have configured this client with user credentials, so it will operate with most bot automation features disabled. To enable, please provide bot credentials instead.`
      );
    }

    this.readyState = ReadyState.Ready;
    this.emit('ready');
    this.logger.info('Client initialised.');
  }

  /**
   * Refreshes client's access token and decoded token.
   */
  async refreshTokens() {
    /* Retrieve and decode JWT. */
    this.accessToken = await this.getAccessToken();
    this.decodedToken = await this.decodeToken(this.accessToken);

    /* Reauthorise API interface. */
    await this.api.auth();

    /* Schedule JWT refresh. */
    clearTimeout(this.refreshTokensDelay);
    const tokenExpiresAfter = 1000 * this.decodedToken.exp - Date.now();
    const tokenRefreshDelay = Math.floor(tokenExpiresAfter * 0.9);
    this.refreshTokensDelay = setTimeout(this.refreshTokens.bind(this), tokenRefreshDelay);

    return this.decodedToken;
  }

  /**
   * Fetches a new access token from the Alta API.
   * The access token is a JWT that can be decoded to retrieve information about your client.
   */
  private async getAccessToken(): Promise<string> {
    this.logger.info('Retrieving access token.');

    const body =
      'clientId' in this.config
        ? new URLSearchParams({
            grant_type: 'client_credentials',
            scope: this.config.scope.join(' '),
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret
          })
        : JSON.stringify({
            username: this.config.username,
            password_hash: this.hashPassword(this.config.password)
          });

    const bodyString = body.toString();
    this.logger.debug('Created access token request payload.', bodyString);

    const headers = new Headers({
      'Content-Length': bodyString.length.toString(),
      'User-Agent': this.name
    });

    if ('clientId' in this.config) {
      headers.append('Content-Type', 'application/x-www-form-urlencoded');
    } else {
      headers.append('Content-Type', 'application/json');
      headers.append('x-api-key', this.config.xApiKey);
    }

    this.logger.debug('Configured access token request headers.', headers);

    const endpoint =
      'clientId' in this.config ? this.config.tokenUrl : `${this.config.restBaseUrl}${Endpoint.Sessions}`;

    try {
      this.logger.debug('Sending access token request.');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body
      });

      const data = await response.json();
      this.logger.debug('Retrieving access token data.', JSON.stringify(data));

      if (!response.ok) {
        const error = (data && data.message) || response.status;
        throw new Error(error);
      }

      const { access_token: accessToken } = data;
      this.logger.debug('Found access token.', accessToken);

      return accessToken as string;
    } catch (error) {
      this.logger.error(
        'There was an error when retrieving the access token. Retrying in 10 seconds.',
        (error as Error).message
      );

      await new Promise(resolve => setTimeout(resolve, 10000));

      return await this.getAccessToken();
    }
  }

  /**
   * Takes an access token and decodes it to get its JWT payload.
   */
  private async decodeToken(accessToken: string): Promise<DecodedToken> {
    this.logger.info('Decoding access token.');

    try {
      const decodedToken = jwtDecode.default<DecodedToken>(accessToken);
      this.logger.debug('Decoded access token.', JSON.stringify(decodedToken));

      return decodedToken;
    } catch (error) {
      this.logger.error((error as Error).message);

      await new Promise(resolve => setTimeout(resolve, 10000));

      const accessToken = await this.getAccessToken();

      return await this.decodeToken(accessToken);
    }
  }

  /**
   * Checks if the group is present in includedGroups and excludedGroups
   * configuration, and returns whether or not this group is allowed to
   * be managed by this client.
   */
  private isAllowedGroup(groupId: number) {
    const mustBeIncluded = this.config.includedGroups.length > 0;
    const isIncluded = this.config.includedGroups.includes(groupId);
    const isExcluded = this.config.excludedGroups.includes(groupId);

    return mustBeIncluded ? isIncluded : !isExcluded;
  }

  /**
   * Starts managing a group and its servers.
   */
  private async addGroup(group: GroupInfo, member: GroupMemberInfo) {
    this.logger.debug(`Adding group ${group.id} (${group.name}).`);

    if (Object.keys(this.groups).map(Number).includes(group.id)) {
      this.logger.error(`Can't add group ${group.id} (${group.name}) more than once.`);
      return;
    }

    if (!this.isAllowedGroup(group.id)) {
      this.logger.warn(
        `Client is a member of group ${group.id} (${group.name}) which is either not configured as an included group, or is configured as an excluded group.`
      );
      return;
    }

    const managedGroup = new Group(this, group, member);

    this.groups = {
      ...this.groups,
      [group.id]: managedGroup
    } as Groups;

    return await managedGroup.init();
  }

  /**
   * Stops managing a group and its servers.
   */
  private async removeGroup(groupId: number) {
    this.logger.debug(`Removing group ${groupId}.`);

    const group = this.groups[groupId];

    if (typeof group === 'undefined') {
      this.logger.error(`Can't remove an unmanaged group with ID ${groupId}.`);
      return;
    }

    await group.dispose();
    delete this.groups[groupId];
  }

  /**
   * Hashes a password.
   */
  private hashPassword(password: string): string {
    if (/^[0-9a-f]{128}$/i.test(password)) {
      return password;
    } else {
      const hashedPassword = createHash('sha512').update(password).digest('hex');
      this.logger.warn(
        `You are using an unhashed password to configure this client. For increased security, please consider replacing any mention of your password in any of your project files with this hash of your password instead: ${hashedPassword}`
      );

      return hashedPassword;
    }
  }

  /**
   * Connects to a server and promises a server connection. This is particularly
   * useful for semi-automatic bots using User credentials instead of Bot
   * credentials. This method can throw on various exceptions—such as the server
   * being offline—and should probably be wrapped in a try/catch block.
   *
   * @example
   * try {
   *   const connection = await client.openServerConnection(serverId);
   *
   *   connection.subscribe('PlayerJoined', message => {
   *     const { id, username } = message.data.user;
   *     connection.send(`player message ${id} "Greetings, ${username}!" 5`);
   *   });
   * } catch (error) {
   *   // your error handling
   * }
   */
  async openServerConnection(serverId: number) {
    if (this.readyState !== ReadyState.Ready) throw new Error('Client is not ready yet.');

    if ('clientId' in this.config) {
      this.logger.warn(
        "You are manually opening a server connection, but client is in bot automation mode. You should probably handle your server connection via client.on('connect') instead."
      );
    }

    const decodedToken = this.decodedToken ?? (await this.refreshTokens());
    const userId = 'client_sub' in decodedToken ? decodedToken.client_sub : decodedToken.UserId;
    const serverInfo = await this.api.getServerInfo(serverId);
    const groupId = serverInfo.group_id;
    const [groupInfo, memberInfo] = await Promise.all([
      this.api.getGroupInfo(groupId),
      this.api.getGroupMember(groupId, userId)
    ]);

    const group = new Group(this, groupInfo, memberInfo);
    const server = await new Promise<Server>(resolve => {
      group.on('server-add', server => {
        if (server.id === serverId) resolve(server);
      });
    });

    const connection =
      server.status === 'connecting'
        ? new Promise<ServerConnection>(resolve => {
            server.once('connect', connection => resolve(connection));
          })
        : server.connect();

    return await connection;
  }
}
