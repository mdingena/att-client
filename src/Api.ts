import type { Scope } from './Config';
import { REST_BASE_URL, X_API_KEY } from './constants';
import { Logger, Verbosity } from './Logger';

export type DecodedToken = {
  nbf: number;
  exp: number;
  iss: string;
  aud: string[];
  client_id: string;
  client_sub: string;
  client_username: string;
  client_bot: 'true' | 'false';
  scope: Scope;
};

export class Api {
  accessToken?: string;
  clientId: string;
  headers?: Headers;
  logger: Logger;

  constructor(clientId: string, logger: Logger = new Logger(Verbosity.Warning)) {
    this.clientId = clientId;
    this.logger = logger;
  }

  /**
   * Authorise API requests with an access token.
   */
  auth(accessToken: string) {
    this.accessToken = accessToken;
    this.headers = new Headers({
      'Content-Type': 'application/json',
      'x-api-key': X_API_KEY,
      'User-Agent': this.clientId,
      'Authorization': `Bearer ${accessToken}`
    });
  }

  private get(endpoint: string, params?: { [key: string]: string | number }) {
    if (typeof this.headers === 'undefined') {
      throw new Error('API is not initialised.');
    }

    const url = new URL(`${REST_BASE_URL}${endpoint}`);

    if (typeof params !== 'undefined') {
      Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value.toString()));
    }

    return fetch(url.toString(), {
      method: 'GET',
      headers: this.headers
    });
  }

  getJoinedGroups() {
    return this.get('/groups/joined', { limit: 1000 });
  }
}
