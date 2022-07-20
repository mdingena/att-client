import type { ApiRequest } from './ApiRequest';
import type { ApiResponse } from './ApiResponse';
import type { HttpMethod } from './HttpMethod';
import type { Client } from '../Client';
import { Endpoint } from './Endpoint';

type Parameters = Record<string, string | number>;

export class Api {
  client: Client;

  private headers?: Headers;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Authorises API requests with an access token.
   */
  async auth() {
    if (typeof this.client.accessToken === 'undefined') {
      this.client.logger.error(
        "Can't authorise API requests without an access token. Ordering client to refresh tokens."
      );
      await this.client.refreshTokens();
      return;
    }

    this.headers = new Headers({
      'Content-Type': 'application/json',
      'x-api-key': this.client.config.xApiKey,
      'User-Agent': this.client.name,
      'Authorization': `Bearer ${this.client.accessToken}`
    });
  }

  /**
   * Accepts a group's invite.
   */
  acceptGroupInvite(groupId: number) {
    return this.post(Endpoint.AcceptGroupInvite, { groupId });
  }

  /**
   * Gets a group's information such as name, description, roles and servers.
   */
  getGroupInfo(groupId: number) {
    return this.get(Endpoint.GroupInfo, { groupId });
  }

  /**
   * Gets a group's member's information, such as name, user ID and group role ID.
   */
  getGroupMember(groupId: number, userId: string) {
    return this.get(Endpoint.GroupMember, { groupId, userId });
  }

  /**
   * Gets all groups that this client is a member of. Returns group info and client's
   * membership info for each group.
   */
  getJoinedGroups() {
    return this.get(Endpoint.JoinedGroups, undefined, { limit: 1000 });
  }

  /**
   * Gets all open group invitations for this client.
   */
  getPendingGroupInvites() {
    return this.get(Endpoint.GroupInvites, undefined, { limit: 1000 });
  }

  /**
   * Gets a server's console connection details.
   */
  getServerConnectionDetails(serverId: number) {
    return this.post(Endpoint.ServerConsole, { serverId }, undefined, { should_launch: false, ignore_offline: false });
  }

  /**
   * Gets a server's information, such as online players and heartbeat status.
   */
  getServerInfo(serverId: number) {
    return this.get(Endpoint.ServerInfo, { serverId });
  }

  /**
   * Sends a GET request to Alta's REST API.
   */
  private get<T extends Endpoint>(endpoint: T, params?: Parameters, query?: Parameters) {
    const url = this.createUrl(endpoint, params, query);

    return this.request('GET', url) as Promise<undefined | ApiResponse<`GET ${T}`>['body']>;
  }

  /**
   * Sends a POST request to Alta's REST API.
   */
  private post<T extends Endpoint>(
    endpoint: T,
    params?: Partial<Parameters>,
    query?: Parameters,
    payload?: ApiRequest
  ) {
    const url = this.createUrl(endpoint, params, query);

    return this.request('POST', url, payload) as Promise<undefined | ApiResponse<`POST ${T}`>['body']>;
  }

  /**
   * Constructs a request to send to Alta's REST API.
   */
  private async request(method: HttpMethod, url: URL, payload?: ApiRequest): Promise<unknown> {
    if (typeof this.headers === 'undefined') {
      this.client.logger.error('API is not authorised. Ordering authorisation now.');
      await this.auth();
      return await this.request(method, url, payload);
    }

    this.client.logger.debug(`Requesting ${method} ${url}`, JSON.stringify(payload));

    const response = await fetch(url.toString(), {
      method,
      headers: this.headers,
      body: typeof payload === 'undefined' ? null : JSON.stringify(payload)
    });

    if (!response.ok) {
      this.client.logger.error(`${method} ${url} ${payload} responded with ${response.status} ${response.statusText}.`);

      try {
        const body = await response.json();
        this.client.logger.error(JSON.stringify(body));
      } catch (error) {
        this.client.logger.error(error);
      }

      return;
    }

    return await response.json();
  }

  /**
   * Creates a URL by populating an endpoint template with parameters and optional
   * query string.
   */
  private createUrl<T extends Endpoint>(template: T, params: Partial<Parameters> = {}, query?: Parameters) {
    const endpoint = template.replace(/{(.*?)}/g, (_, match) => params[match]?.toString() ?? `{${match}}`);

    const url = new URL(`${this.client.config.restBaseUrl}${endpoint}`);

    if (typeof query !== 'undefined') {
      Object.entries(query).forEach(([key, value]) => url.searchParams.append(key, value.toString()));
    }

    return url;
  }
}
