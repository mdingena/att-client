import type { Api } from '../Api';
import type { GroupInfo, GroupMemberInfo, ServerInfo } from '../Api/schemas';
import type { Client } from '../Client';
import type { Logger } from '../Logger';
import type { Subscriptions } from '../Subscriptions';
import { TypedEmitter } from 'tiny-typed-emitter';
import { Server } from '../Server';

type Role = {
  id: number;
  name: string;
  permissions: string[];
};

type Servers = Record<number, Server>;

interface Events {
  update: (group: Group) => void;
}

export class Group extends TypedEmitter<Events> {
  client: Client;
  description: string;
  id: number;
  name: string;
  permissions: string[];
  roles: Role[];
  servers: Servers;

  private api: Api;
  private logger: Logger;
  private subscriptions: Subscriptions;
  private userId: number;

  constructor(client: Client, group: GroupInfo, member: GroupMemberInfo) {
    super();

    this.logger = client.logger;

    this.api = client.api;
    this.client = client;
    this.description = group.description ?? '';
    this.id = group.id;
    this.name = group.name ?? '';
    this.permissions = this.getPermissions(group, member);
    this.roles = [];
    this.servers = {};
    this.subscriptions = client.subscriptions;
    this.userId = member.user_id;

    if (!this.permissions.includes('Console')) {
      this.logger.warn(
        `This client does not have 'Console' permissions for group ${this.id} (${this.name}).`,
        this.permissions
      );
    }

    this.addServers(group);
  }

  /**
   * Initialises a managed group by subscribing to events. Keeps track of this
   * client's member role within the group and whether or not it is allowed to
   * connect to the group's server consoles.
   */
  async init() {
    await Promise.all([
      /**
       * Subscribe to group updates, such as changes to servers, roles and permissions.
       */
      this.subscriptions.subscribe('group-update', this.id.toString(), async message => {
        const group = message.content;
        const member = await this.api.getGroupMember(this.id, this.userId.toString());

        if (typeof member === 'undefined') {
          this.logger.error(`Couldn't find group member info for group ${group.id} (${this.name}).`);
          return;
        }

        this.updateGroup(group, member);
      }),

      /**
       * Subscribe to group member changes, such as assigned role and permissions.
       */
      this.subscriptions.subscribe('group-member-update', this.id.toString(), async message => {
        const member = message.content;

        if (member.user_id !== this.userId) return;

        this.logger.info(`Membership updated for group ${this.id}.`);
        const group = await this.api.getGroupInfo(this.id);

        if (typeof group === 'undefined') {
          this.logger.error(`Couldn't get info for group ${this.id} (${this.name}).`);
          return;
        }

        this.updateGroup(group, member);
      }),

      /**
       * Subscribe to server status changes, such as number of players and online or
       * offline state.
       */
      this.subscriptions.subscribe('group-server-status', this.id.toString(), async message => {
        const status = message.content;

        this.logger.debug(`Status updated for server ${status.id} (${status.name}).`, status);
        this.manageServerConnection(status);
      }),

      /**
       * Subscribe to servers being created in this group.
       *
       * WARNING: This subscription is untested because currently only developers are
       * capable or creating servers. Currently, all groups have a single server but
       * it's possible that in the future any single group can have more than one
       * server that may be created by players themselves.
       */
      this.subscriptions.subscribe('group-server-create', this.id.toString(), _unstableMessage => {
        /* ⚠️ This code is untested because I can't create new servers. */
        this.logger.warn('Client is running untested group-server-create code in Group.ts.', _unstableMessage);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const serverId = _unstableMessage.content.id as number;
        this.addServer(serverId);
      }),

      /**
       * Subscribe to servers being deleted in this group.
       *
       * WARNING: This subscription is untested because currently only developers are
       * capable or deleting servers. Currently, all groups have a single server but
       * it's possible that in the future any single group can have more than one
       * server that may be deleted by players themselves.
       */
      this.subscriptions.subscribe('group-server-delete', this.id.toString(), _unstableMessage => {
        /* ⚠️ This code is untested because I can't delete servers. */
        this.logger.warn('Client is running untested group-server-delete code in Group.ts.', _unstableMessage);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const serverId = _unstableMessage.content.id as number;
        this.removeServer(serverId);
      })
    ]);

    return this.updateServers();
  }

  /**
   * Updates all managed servers with new server info.
   */
  private updateServers() {
    return Promise.all(Object.values(this.servers).map(async server => this.updateServer(server.id)));
  }

  /**
   * Updates a server with new server info.
   */
  private async updateServer(serverId: number) {
    this.logger.debug(`Updating info for server ${serverId}.`);
    const status = await this.api.getServerInfo(serverId);

    if (typeof status === 'undefined') {
      this.logger.error(`Couldn't get status for server ${serverId} (${this.name}).`);
      return;
    }

    this.manageServerConnection(status);
  }

  /**
   * Updates the group's details.
   */
  private async updateGroup(group: GroupInfo, member: GroupMemberInfo) {
    this.name = group.name ?? this.name;
    this.description = group.description ?? this.description;
    this.roles =
      group.roles?.map(role => ({ id: role.role_id, name: role.name ?? '', permissions: role.permissions })) ??
      this.roles;

    await this.updatePermissions(group, member);

    this.emit('update', this);
  }

  /**
   * Updates this client's permissions for the given group with the given member info.
   */
  private async updatePermissions(group: GroupInfo, member: GroupMemberInfo) {
    const previousPermissions = [...this.permissions];
    this.permissions = this.getPermissions(group, member);

    if (!previousPermissions.includes('Console') && this.permissions.includes('Console')) {
      this.logger.info(`Client gained console access to servers in group ${this.id} (${this.name}).`);
    } else if (previousPermissions.includes('Console') && !this.permissions.includes('Console')) {
      this.logger.info(`Client lost console access to servers in group ${this.id} (${this.name}).`);
    }

    await this.updateServers();
  }

  /**
   * Gets a member's permissions for the given group.
   */
  private getPermissions(group: GroupInfo, member: GroupMemberInfo) {
    const roleId = member.role_id;
    const roles = group.roles ?? [];

    const role = roles.find(role => role.role_id === roleId);

    return role?.permissions ?? [];
  }

  /**
   * Connects or disconnects a server based on its online status.
   */
  private async manageServerConnection(status: ServerInfo) {
    const serverId = status.id;
    const server = this.servers[serverId];

    if (typeof server === 'undefined') {
      this.logger.error(`Server ${serverId} not found in group ${this.id} (${this.name}).`);
      return;
    }

    const mayConnect = this.permissions.includes('Console');
    const lastHeartbeatAt = +new Date(status.online_ping ?? '2022-06-01T00:00:00.000Z');
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeatAt;
    const isServerOnline = timeSinceLastHeartbeat < this.client.config.serverHeartbeatTimeout;

    if (server.status === 'disconnected' && mayConnect && isServerOnline) {
      await server.connect();
    } else if (server.status !== 'disconnected' && (!mayConnect || !isServerOnline)) {
      server.disconnect();
    }

    server.update(status);
  }

  /**
   * Starts managing all servers listed in a given group info.
   */
  private addServers(group: GroupInfo) {
    this.logger.debug(`Adding all servers for group ${this.id} (${this.name}).`);

    for (const server of group.servers ?? []) {
      this.addServer(server.id);
    }
  }

  /**
   * Starts managing the given server.
   */
  private async addServer(serverId: number) {
    this.logger.debug(`Adding server ${serverId} (${this.name}).`);

    if (Object.keys(this.servers).map(Number).includes(serverId)) {
      this.logger.error(`Can't add server ${serverId} (${this.name}) more than once.`);
      return;
    }

    const server = await this.api.getServerInfo(serverId);

    if (typeof server === 'undefined') {
      this.logger.error(`Couldn't get info for server ${serverId} (${this.description}).`);
      return;
    }

    this.servers = {
      ...this.servers,
      [serverId]: new Server(this, server)
    } as Servers;
  }

  /**
   * Removes all managed servers from this group.
   */
  private removeServers() {
    this.logger.debug(`Removing all servers from group ${this.id} (${this.name}).`);

    for (const server of Object.values(this.servers)) {
      this.removeServer(server.id);
    }
  }

  /**
   * Removes the given managed server from this group.
   */
  private removeServer(serverId: number) {
    this.logger.debug(`Removing server ${serverId} (${this.name}).`);

    const server = this.servers[serverId];

    if (typeof server === 'undefined') {
      this.logger.error(`Can't remove an unmanaged server with ID ${serverId} (${this.name}).`);
      return;
    }

    server.dispose();
    delete this.servers[serverId];
  }

  /**
   * Disposes of this group. Tears down all managed servers and subscriptions.
   */
  async dispose() {
    this.removeServers();

    await Promise.all([
      this.subscriptions.unsubscribe('group-update', this.id.toString()),
      this.subscriptions.unsubscribe('group-server-create', this.id.toString()),
      this.subscriptions.unsubscribe('group-server-delete', this.id.toString()),
      this.subscriptions.unsubscribe('group-server-status', this.id.toString()),
      this.subscriptions.unsubscribe('group-member-update', this.id.toString())
    ]);
  }
}
