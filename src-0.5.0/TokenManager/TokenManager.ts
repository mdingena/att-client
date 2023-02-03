import type { BotCredentials, Scope, UserCredentials } from '../ClientConfiguration/ClientConfiguration.js';
import type { InternalClientConfiguration } from '../ClientConfiguration/InternalClientConfiguration.js';
import type { Log } from '../Log/Log.js';
import jwtDecode from 'jwt-decode';
import { BotTokenRequest } from './BotTokenRequest.js';
import { UserTokenRequest } from './UserTokenRequest.js';

type CommonToken = {
  nbf: number;
  exp: number;
  iss: string;
  aud: string[];
};

type BotToken = CommonToken & {
  client_id: string;
  client_sub: string;
  client_username: string;
  client_bot: 'true' | 'false';
  scope: Scope;
};

type UserToken = CommonToken & {
  UserId: string;
  Username: string;
  role: string;
  is_verified: string;
  Policy: string[];
};

export type DecodedToken = BotToken | UserToken;

export type TokenManagerConfiguration = Pick<
  InternalClientConfiguration,
  'credentials' | 'restBaseUrl' | 'tokenUrl' | 'xApiKey'
>;

type BotConfiguration = Omit<TokenManagerConfiguration, 'credentials'> & {
  credentials: BotCredentials;
};

type UserConfiguration = Omit<TokenManagerConfiguration, 'credentials'> & {
  credentials: UserCredentials;
};

export function isBotConfiguration(configuration: TokenManagerConfiguration): configuration is BotConfiguration {
  return 'clientId' in configuration.credentials;
}

export function isUserConfiguration(configuration: TokenManagerConfiguration): configuration is UserConfiguration {
  return 'username' in configuration.credentials;
}

export class TokenManager {
  accessToken: string | undefined;
  decodedToken: DecodedToken | undefined;

  private configuration: TokenManagerConfiguration;
  private log: Log;
  private refreshDelay?: NodeJS.Timeout;

  constructor(config: TokenManagerConfiguration, log: Log) {
    this.configuration = config;
    this.log = log;
  }

  /**
   * Refreshes access token and decoded token.
   */
  async refresh(): Promise<void> {
    clearTimeout(this.refreshDelay);
    delete this.refreshDelay;

    /* Retrieve and decode JWT. */
    this.accessToken = await this.getAccessToken();
    this.decodedToken = await this.decodeToken(this.accessToken);

    /* Schedule JWT refresh. */
    const tokenExpiresAfter = 1000 * this.decodedToken.exp - Date.now();
    const tokenRefreshDelay = Math.floor(tokenExpiresAfter * 0.9);
    this.refreshDelay = setTimeout(this.refresh.bind(this), tokenRefreshDelay);
  }

  /**
   * Fetches a new access token from the Alta API.
   * The access token is a JWT that can be decoded to retrieve information about your client.
   */
  private async getAccessToken(): Promise<string> {
    let accessToken: string | undefined;

    while (typeof accessToken === 'undefined') {
      this.log.debug('Retrieving access token.');

      const tokenRequest = isBotConfiguration(this.configuration)
        ? new BotTokenRequest(this.configuration)
        : isUserConfiguration(this.configuration)
        ? new UserTokenRequest(this.configuration)
        : null;

      if (tokenRequest === null) throw new Error();

      try {
        this.log.debug('Sending access token request.');
        const response = await fetch(tokenRequest);

        const data = await response.json();
        this.log.debug('Retrieving access token data.', JSON.stringify(data));

        if (!response.ok) {
          const error = (data && data.message) || response.status;
          throw new Error(error);
        }

        this.log.debug('Found access token.', data.access_token);

        accessToken = data.access_token as string;
      } catch (error) {
        this.log.error(
          'There was an error when retrieving the access token. Retrying in 10 seconds.',
          (error as Error).message
        );

        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    return accessToken;
  }

  /**
   * Takes an access token and decodes it to get its JWT payload.
   */
  private decodeToken(accessToken: string): DecodedToken {
    this.log.debug('Decoding access token.');

    return jwtDecode.default<DecodedToken>(accessToken);
  }
}
