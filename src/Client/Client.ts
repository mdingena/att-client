import type { GroupInfo, GroupMemberInfo } from '../Api/schemas';
import type { Config } from './Config';
import type { ServerConnection } from '../ServerConnection';
import { TypedEmitter } from 'tiny-typed-emitter';
import jwtDecode from 'jwt-decode';
import { Api, DecodedToken } from '../Api';
import { Group } from '../Group';
import { Logger } from '../Logger';
import { Subscriptions } from '../Subscriptions';
import { DEFAULTS } from '../constants';

interface Events {
  connect: (serverConnection: ServerConnection) => void;
  ready: () => void;
}

type Groups = Record<number, Group>;

export class Client extends TypedEmitter<Events> {
  accessToken?: string;
  api: Api;
  config: Required<Config>;
  groups: Groups;
  logger: Logger;
  subscriptions: Subscriptions;

  private decodedToken?: DecodedToken;
  private initialised: boolean;
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
    }

    const configuredLogVerbosity = config.logVerbosity ?? DEFAULTS.logVerbosity;

    /* Create logger. */
    this.logger = new Logger(configuredLogVerbosity, configuredConsole);
    this.logger.info('Configuring client.');

    /* Validate required configuration. */
    const { clientId, clientSecret, scope } = config;

    if ([typeof clientId, typeof clientSecret, typeof scope].includes('undefined')) {
      this.logger.error("Cannot create client without 'clientId', 'clientSecret', and 'scope'.");
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

    /* Save configuration. */
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      console: configuredConsole,
      excludedGroups:
        config.excludedGroups && (typeof config.includedGroups === 'undefined' || config.includedGroups.length === 0)
          ? config.excludedGroups
          : DEFAULTS.excludedGroups,
      includedGroups: config.includedGroups ?? DEFAULTS.includedGroups,
      logVerbosity: configuredLogVerbosity,
      scope: config.scope,
      resubscriptionTimeout: config.resubscriptionTimeout ?? DEFAULTS.resubscriptionTimeout,
      restBaseUrl: config.restBaseUrl ?? DEFAULTS.restBaseUrl,
      serverHeartbeatTimeout: config.serverHeartbeatTimeout ?? DEFAULTS.serverHeartbeatTimeout,
      tokenUrl: config.tokenUrl ?? DEFAULTS.tokenUrl,
      webSocketMigrationHandoverPeriod:
        config.webSocketMigrationHandoverPeriod ?? DEFAULTS.webSocketMigrationHandoverPeriod,
      webSocketMigrationInterval: config.webSocketMigrationInterval ?? DEFAULTS.webSocketMigrationInterval,
      webSocketMigrationRetryDelay: config.webSocketMigrationRetryDelay ?? DEFAULTS.webSocketMigrationRetryDelay,
      webSocketPingInterval: config.webSocketPingInterval ?? DEFAULTS.webSocketPingInterval,
      webSocketRecoveryRetryDelay: config.webSocketRecoveryRetryDelay ?? DEFAULTS.webSocketRecoveryRetryDelay,
      webSocketRequestAttempts: config.webSocketRequestAttempts ?? DEFAULTS.webSocketRequestAttempts,
      webSocketRequestRetryDelay: config.webSocketRequestRetryDelay ?? DEFAULTS.webSocketRequestRetryDelay,
      webSocketUrl: config.webSocketUrl ?? DEFAULTS.webSocketUrl,
      xApiKey: config.xApiKey ?? DEFAULTS.xApiKey
    };

    /* Initialise internals. */
    this.api = new Api(this);
    this.groups = {};
    this.initialised = false;
    this.subscriptions = new Subscriptions(this);
  }

  /**
   * Launches the client. Connects to Alta API and WebSocket, and subscribes
   * to events for account management. Keeps track of managed groups and
   * servers.
   */
  async start() {
    if (this.initialised) {
      this.logger.error('This client is already initialised.');
      return;
    }

    this.initialised = true;
    this.logger.info('Initialising client.');

    /* Configure access token and decoded token. */
    const decodedToken = await this.refreshTokens();

    const userId = decodedToken.client_sub;

    /* Initialise subscriptions. */
    this.logger.info('Subscribing to events.');
    await this.subscriptions.init();

    try {
      /* Subscribe to account messages. */
      this.logger.debug('Subscribing to account messages.');

      await Promise.allSettled([
        /* Subscribe to and handle server group invitation message. */
        this.subscriptions.subscribe('me-group-invite-create', userId, message => {
          const { id, name } = message.content;

          this.logger.info(`Accepting invite to group ${id} (${name})`);
          this.api.acceptGroupInvite(id);
        }),

        /* Subscribe to and handle server group joined message. */
        this.subscriptions.subscribe('me-group-create', userId, async message => {
          /*
           * The group info from this message is missing information about
           * this group's servers and roles. So we'll use the group ID from
           * this message to fetch more complete information. We'll also
           * need to get this client's group membership details to determine
           * group permissions.
           */
          const groupId = message.content.id;
          const groupName = message.content.name;

          this.logger.info(`Client was added to group ${groupId} (${groupName}).`);

          const group = await this.api.getGroupInfo(groupId);
          const member = await this.api.getGroupMember(groupId, userId);

          if (typeof group === 'undefined') {
            this.logger.error(`Couldn't get info for group ${groupId} (${groupName}).`);
            return;
          }

          if (typeof member === 'undefined') {
            this.logger.error(`Couldn't find group member info for group ${group.id} (${groupName}).`);
            return;
          }

          /* Create a new managed group. */
          this.addGroup(group, member);
        }),

        /* Subscribe to and handle server group left message. */
        this.subscriptions.subscribe('me-group-delete', userId, message => {
          const groupId = message.content.group.id;
          const groupName = message.content.group.name;

          this.logger.info(`Client was removed from group ${groupId} (${groupName}).`);
          this.removeGroup(groupId);
        })
      ]);

      /* Manage all joined groups. */
      const joinedGroups = (await this.api.getJoinedGroups()) ?? [];

      if (joinedGroups.length > 0) {
        this.logger.info(`Managing ${joinedGroups.length} group${joinedGroups.length > 1 ? 's' : ''}.`);
        await Promise.all(joinedGroups.map(({ group, member }) => this.addGroup(group, member)));
      }

      /* Accept pending group invites. */
      const invites = (await this.api.getPendingGroupInvites()) ?? [];

      if (invites.length > 0) {
        this.logger.info(`Accepting ${invites.length} pending group invite${invites.length > 1 ? 's' : ''}.`);
        await Promise.all(invites.map(async invite => this.api.acceptGroupInvite(invite.id)));
      }
    } catch (error) {
      this.logger.error((error as Error).message);
      return;
    }

    this.logger.info('Client initialised.');
    this.emit('ready');
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

    const body = new URLSearchParams();
    body.append('grant_type', 'client_credentials');
    body.append('client_id', this.config.clientId);
    body.append('client_secret', this.config.clientSecret);
    body.append('scope', this.config.scope.join(' '));

    const bodyString = body.toString();
    this.logger.debug('Created access token request payload.', bodyString);

    const headers = {
      'Host': 'accounts.townshiptale.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': bodyString.length.toString(),
      'User-Agent': this.config.clientId
    };
    this.logger.debug('Configured access token request headers.', headers);

    try {
      this.logger.debug('Sending access token request.');
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers,
        body
      });

      const data = await response.json();
      this.logger.debug('Retrieving access token data.', data);

      if (!response.ok) {
        const error = (data && data.message) || response.status;
        throw new Error(error);
      }

      const { access_token: accessToken } = data;
      this.logger.debug('Found access token.', accessToken);

      return accessToken as string;
    } catch (error) {
      this.logger.error('There was an error when retrieving the access token. Retrying in 10 seconds.', error);

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
      const decodedToken = jwtDecode<DecodedToken>(accessToken);
      this.logger.debug('Decoded access token.', decodedToken);

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
  private addGroup(group: GroupInfo, member: GroupMemberInfo) {
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

    return managedGroup.init();
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
}
