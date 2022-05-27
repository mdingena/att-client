import type { ApiResponse } from './ApiResponse';
import type { Scope } from '../Config';
import type { HttpMethod } from './HttpMethod';
import { Endpoint } from './Endpoint';
import { REST_BASE_URL, X_API_KEY } from '../constants';
import { Logger, Verbosity } from '../Logger';

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

type Parameters = { [parameter: string]: string | number };

export class Api {
  accessToken?: string;
  clientId: string;
  headers?: Headers;
  logger: Logger;
  userId?: string;

  constructor(clientId: string, logger: Logger = new Logger(Verbosity.Warning)) {
    this.clientId = clientId;
    this.logger = logger;
  }

  /**
   * Authorise API requests with an access token.
   */
  auth(userId: string, accessToken: string) {
    this.accessToken = accessToken;
    this.headers = new Headers({
      'Content-Type': 'application/json',
      'x-api-key': X_API_KEY,
      'User-Agent': this.clientId,
      'Authorization': `Bearer ${accessToken}`
    });
    this.userId = userId;
  }

  acceptGroupInvite(groupIdentifier: number) {
    return this.post(Endpoint.AcceptGroupInvite, { groupIdentifier });
  }

  declineGroupInvite(groupIdentifier: number) {
    return this.delete(Endpoint.DeclineGroupInvite, { groupIdentifier });
  }

  getJoinedGroups() {
    return this.get(Endpoint.JoinedGroups, { limit: 1000 });
  }

  getPendingGroupInvites() {
    return this.get(Endpoint.GroupInvites, { limit: 1000 });
  }

  private get<T extends Endpoint>(endpoint: T, params?: Parameters): Promise<ApiResponse<`GET ${T}`>['body']> {
    const url = new URL(`${REST_BASE_URL}${endpoint}`);

    if (typeof params !== 'undefined') {
      Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value.toString()));
    }

    return this.request('GET', url);
  }

  private post<T extends Endpoint>(
    endpoint: T,
    params?: Partial<Parameters>
  ): Promise<ApiResponse<`POST ${T}`>['body']> {
    const interpolatedEndpoint = this.interpolateEndpoint(endpoint, params);
    const url = new URL(`${REST_BASE_URL}${interpolatedEndpoint}`);

    return this.request('POST', url);
  }

  private delete<T extends Endpoint>(
    endpoint: T,
    params?: Partial<Parameters>
  ): Promise<ApiResponse<`DELETE ${T}`>['body']> {
    const interpolatedEndpoint = this.interpolateEndpoint(endpoint, params);
    const url = new URL(`${REST_BASE_URL}${interpolatedEndpoint}`);

    return this.request('DELETE', url);
  }

  private async request(method: HttpMethod, url: URL) {
    if (typeof this.headers === 'undefined' || typeof this.userId === 'undefined') {
      throw new Error('API is not initialised.');
    }

    this.logger.debug(`Requesting ${method} ${url}`);

    const response = await fetch(url.toString(), { method, headers: this.headers });
    const body = await response.json();

    if (!response.ok) throw new Error(response.statusText);

    return body;
  }

  private interpolateEndpoint<T extends Endpoint>(template: T, params: Partial<Parameters> = {}) {
    return template.replace(/{(.*?)}/g, (_, match) => params[match]?.toString() ?? `{${match}}`);
  }
}
