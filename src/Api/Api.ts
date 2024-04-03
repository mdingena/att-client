import type { ApiRequest } from './ApiRequest.js';
import type { ApiResponse } from './ApiResponse.js';
import type { HttpMethod } from './HttpMethod.js';
import type { Client } from '../Client/index.js';
import type { InvitedGroupInfo } from './schemas/InvitedGroupInfo.js';
import type { JoinedGroupInfo } from './schemas/JoinedGroupInfo.js';
import { Endpoint } from './Endpoint.js';

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
  async acceptGroupInvite(groupId: number) {
    const response = await this.request('POST', Endpoint.AcceptGroupInvite, { groupId });

    return await response.json();
  }

  /**
   * Gets a group's information such as name, description, roles and servers.
   */
  async getGroupInfo(groupId: number) {
    const response = await this.request('GET', Endpoint.GroupInfo, { groupId });

    return await response.json();
  }

  /**
   * Gets a group's member's information, such as name, user ID and group role ID.
   */
  async getGroupMember(groupId: number, userId: string) {
    const response = await this.request('GET', Endpoint.GroupMember, { groupId, userId });

    return await response.json();
  }

  /**
   * Gets all groups that this client is a member of. Returns group info and client's
   * membership info for each group.
   */
  async getJoinedGroups() {
    const joinedGroups: JoinedGroupInfo[] = [];

    let response: ApiResponse<'GET', Endpoint.JoinedGroups>;
    let paginationToken: string | null = null;

    do {
      response = await this.request('GET', Endpoint.JoinedGroups, undefined, {
        limit: 1000,
        ...(paginationToken === null ? {} : { paginationToken })
      });

      paginationToken = response.headers.get('paginationToken');

      joinedGroups.push(...(await response.json()));
    } while (paginationToken !== null);

    return joinedGroups;
  }

  /**
   * Gets all open group invitations for this client.
   */
  async getPendingGroupInvites() {
    const pendingInvites: InvitedGroupInfo[] = [];

    let response: ApiResponse<'GET', Endpoint.GroupInvites>;
    let paginationToken: string | null = null;

    do {
      response = await this.request('GET', Endpoint.GroupInvites, undefined, {
        limit: 1000,
        ...(paginationToken === null ? {} : { paginationToken })
      });

      paginationToken = response.headers.get('paginationToken');

      pendingInvites.push(...(await response.json()));
    } while (paginationToken !== null);

    return pendingInvites;
  }

  /**
   * Gets a server's console connection details.
   */
  async getServerConnectionDetails(serverId: number) {
    const response = await this.request('POST', Endpoint.ServerConsole, { serverId }, undefined, {
      should_launch: false,
      ignore_offline: false
    });

    return await response.json();
  }

  /**
   * Gets a server's information, such as online players and heartbeat status.
   */
  async getServerInfo(serverId: number) {
    const response = await this.request('GET', Endpoint.ServerInfo, { serverId });

    return await response.json();
  }

  /**
   * Constructs a request to send to Alta's REST API.
   */
  private async request<TMethod extends HttpMethod, TEndpoint extends Endpoint>(
    method: TMethod,
    endpoint: TEndpoint,
    params?: Partial<Parameters>,
    query?: Parameters,
    payload?: ApiRequest
  ): Promise<ApiResponse<TMethod, TEndpoint>> {
    if (typeof this.headers === 'undefined') {
      this.client.logger.error('API is not authorised. Ordering authorisation now.');
      await this.auth();
      return await this.request<TMethod, TEndpoint>(method, endpoint, params, query, payload);
    }

    const url = this.createUrl(endpoint, params, query);

    this.client.logger.debug(`Requesting ${method} ${url}`, JSON.stringify(payload));

    const response: ApiResponse<TMethod, TEndpoint> = await fetch(url.toString(), {
      method,
      headers: this.headers,
      body: typeof payload === 'undefined' ? null : JSON.stringify(payload)
    });

    if (!response.ok) {
      this.client.logger.error(`${method} ${response.url} responded with ${response.status} ${response.statusText}.`);
      const body = await response.json();
      throw new Error('message' in body ? body.message : JSON.stringify(body));
    }

    return response;
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
