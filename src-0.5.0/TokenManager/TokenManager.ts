import type { InternalClientConfiguration } from '../ClientConfiguration/getInternalClientConfiguration.js';
import type { Log } from '../Log/Log.js';
import { getRequestBody } from './getRequestBody.js';
import { AGENT } from '../constants.js';
import { ApiEndpoint } from '../Api/ApiEndpoint.js';

type TokenManagerConfiguration = Pick<
  InternalClientConfiguration,
  'credentials' | 'restBaseUrl' | 'tokenUrl' | 'xApiKey'
>;

export class TokenManager {
  private configuration: TokenManagerConfiguration;
  private log: Log;
  private refreshDelay?: NodeJS.Timeout;

  constructor(config: TokenManagerConfiguration, log: Log) {
    this.configuration = config;
    this.log = log;
  }

  /**
   * Fetches a new access token from the Alta API.
   * The access token is a JWT that can be decoded to retrieve information about your client.
   */
  private async getAccessToken(): Promise<string> {
    let accessToken;

    while (typeof accessToken === 'undefined') {
      this.log.info('Retrieving access token.');

      const body = getRequestBody(this.configuration.credentials);
      const bodyString = body.toString();
      this.log.debug('Created access token request payload.', bodyString);

      const headers = new Headers({
        'Content-Length': bodyString.length.toString(),
        'User-Agent': `${AGENT.name} v${AGENT.version}`
      });

      if ('clientId' in this.configuration.credentials) {
        headers.append('Content-Type', 'application/x-www-form-urlencoded');
      } else {
        headers.append('Content-Type', 'application/json');
        headers.append('x-api-key', this.configuration.xApiKey);
      }

      this.log.debug('Configured access token request headers.', headers);

      const endpoint =
        'clientId' in this.configuration.credentials
          ? this.configuration.tokenUrl
          : `${this.configuration.restBaseUrl}${ApiEndpoint.sessions}`;

      try {
        this.log.debug('Sending access token request.');
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body
        });

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
  private async decodeToken(accessToken: string): Promise<DecodedToken> {
    this.log.info('Decoding access token.');

    try {
      const decodedToken = jwtDecode.default<DecodedToken>(accessToken);
      this.log.debug('Decoded access token.', JSON.stringify(decodedToken));

      return decodedToken;
    } catch (error) {
      this.log.error((error as Error).message);

      await new Promise(resolve => setTimeout(resolve, 10000));

      const accessToken = await this.getAccessToken();

      return await this.decodeToken(accessToken);
    }
  }
}
