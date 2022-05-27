import type { Config } from './Config';
import { EventEmitter } from 'stream';
import jwtDecode from 'jwt-decode';
import { Api, DecodedToken } from './Api';
import { Logger, Verbosity } from './Logger';
import { TOKEN_URL } from './constants';
import { Subscription, Subscriptions } from './Subscriptions';

const DEFAULTS: Required<
  Pick<Config, 'console' | 'excludedServers' | 'includedServers' | 'logVerbosity' | 'supportedServers'>
> = {
  console: console,
  excludedServers: [],
  includedServers: [],
  logVerbosity: Verbosity.Warning,
  supportedServers: ['pcvr', 'quest']
};

export class Client extends EventEmitter {
  accessToken?: string;
  api: Api;
  config: Required<Config>;
  decodedToken?: DecodedToken;
  events: EventEmitter;
  initialised: boolean;
  logger: Logger;
  messageId: number;
  subscriptions: Subscriptions;

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
      typeof config.excludedServers !== 'undefined' &&
      config.excludedServers.length > 0 &&
      typeof config.includedServers !== 'undefined' &&
      config.includedServers.length > 0
    ) {
      this.logger.warn('Client configuration contains both included and excluded servers. Ignoring excluded servers.');
    }

    /* Save configuration. */
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      console: configuredConsole,
      excludedServers:
        config.excludedServers && (typeof config.includedServers === 'undefined' || config.includedServers.length === 0)
          ? config.excludedServers
          : DEFAULTS.excludedServers,
      includedServers: config.includedServers ?? DEFAULTS.includedServers,
      logVerbosity: configuredLogVerbosity,
      scope: config.scope,
      supportedServers: config.supportedServers ?? DEFAULTS.supportedServers
    };

    /* Initialise internals. */
    this.api = new Api(config.clientId, this.logger);
    this.events = new EventEmitter();
    this.initialised = false;
    this.messageId = 0;
    this.subscriptions = new Subscriptions(config.clientId, this.logger);
  }

  async init() {
    if (this.initialised) {
      return this.logger.error('This client is already initialised.');
    }

    this.initialised = true;
    this.logger.info('Initialising client.');

    /* Retrieve and decode JWT. */
    this.accessToken = await this.getAccessToken();
    this.decodedToken = this.decodeToken(this.accessToken);

    const userId = this.decodedToken.client_sub;

    /* Authorise API interface. */
    this.api.auth(userId, this.accessToken);

    /* Initialise Subscriptions WebSocket. */
    await this.subscriptions.init(this.accessToken);

    this.subscriptions.on('ready', async (subscriptions: Subscriptions) => {
      try {
        /* Subscribe to account messages. */
        this.logger.debug('Subscribing to account messages.');

        await Promise.all([
          /* Subscribe to and handle server group invitation message. */
          subscriptions.subscribe(Subscription.GroupInvitationRequested, userId, message => {
            this.logger.debug(`Received ${Subscription.GroupInvitationRequested} message.`, message);
            this.api.acceptGroupInvite(message.content.id);
          }),

          /* Subscribe to and handle server group invite revocation message. */
          subscriptions.subscribe(Subscription.GroupInvitationRevoked, userId, message => {
            this.logger.debug(`Received ${Subscription.GroupInvitationRevoked} message.`, message);
          }),

          /* Subscribe to and handle server group joined message. */
          subscriptions.subscribe(Subscription.JoinedGroup, userId, message => {
            this.logger.debug(`Received ${Subscription.JoinedGroup} message.`, message);
          }),

          /* Subscribe to and handle server group left message. */
          subscriptions.subscribe(Subscription.LeftGroup, userId, message => {
            this.logger.debug(`Received ${Subscription.LeftGroup} message.`, message);
          })
        ]);

        /* Accept pending group invites. */
        const invites = await this.api.getPendingGroupInvites();

        console.log('Invites:', JSON.stringify(invites, null, 2));

        if (invites.length > 0) {
          this.logger.info(`Accepting ${invites.length} pending group invite${invites.length > 1 ? 's' : ''}.`);

          await Promise.all(
            invites.map(async invite => {
              const stuff = await this.api.acceptGroupInvite(invite.id);
              console.log(JSON.stringify(stuff, null, 2));
            })
          );
        }

        /* Subscribe to WebSocket messages for all joined groups. */
        const joined = await this.api.getJoinedGroups();

        console.log(JSON.stringify(joined, null, 2));
      } catch (error) {
        this.logger.error(error);
      }
    });
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
      const response = await fetch(TOKEN_URL, {
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
      this.logger.error('There was an error when retrieving the access token.', error);
      throw new Error('Failed to get access token.');
    }
  }

  /**
   * Takes an access token and decodes it to get its JWT payload.
   */
  private decodeToken(accessToken: string): DecodedToken {
    this.logger.info('Decoding access token.');

    const decodedToken = jwtDecode<DecodedToken>(accessToken);
    this.logger.debug('Decoded access token.', decodedToken);

    return decodedToken;
  }
}
