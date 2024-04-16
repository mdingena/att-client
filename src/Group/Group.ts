import type { GroupInfo, GroupMemberInfo, ServerInfo } from '../Api/schemas/index.js';
import type { Client } from '../Client/index.js';
import { TypedEmitter } from '@mdingena/tiny-typed-emitter';
import { Server } from '../Server/index.js';

type Role = {
  id: number;
  name: string;
  permissions: string[];
};

type Servers = Record<number, Server>;

interface Events {
  'server-add': (server: Server) => void;
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

  private keepAlive: NodeJS.Timer | undefined;
  private missedHeartbeats: number;
  private userId: number;

  constructor(client: Client, group: GroupInfo, member: GroupMemberInfo) {
    super();

    this.client = client;
    this.description = group.description ?? '';
    this.id = group.id;
    this.keepAlive = undefined;
    this.missedHeartbeats = 0;
    this.name = group.name ?? '';
    this.permissions = this.getPermissions(group, member);
    this.roles = [];
    this.servers = {};
    this.userId = member.user_id;

    if (!this.permissions.includes('Console')) {
      this.client.logger.warn(
        `[GROUP-${this.id}] Client does not have 'Console' permissions.`,
        JSON.stringify(this.permissions)
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
      this.client.subscriptions.subscribe('group-update', this.id.toString(), async message => {
        try {
          const group = message.content;
          /**
           * 2024-04-08 v0.5.2
           * This callback used to request group membership details to handle cases where group roles
           * and permissions have changed. This appears to be problematic for servers with very large
           * number of members somehow. The exact cause was not determined, but sometimes this update
           * would cause att-client to think it lost console access. Given that group roles and
           * permissions can't be modified easily through the Tavern website anymore, we're going to
           * skip permission checks entirely when we receive this message. We'll only check permissions
           * when we receive a group-member-update message.
           */
          this.updateGroup(group);
        } catch (error) {
          this.client.logger.error(`[GROUP-${this.id}] Error while handling group update: ${(error as Error).message}`);
        }
      }),

      /**
       * Subscribe to group member changes, such as assigned role and permissions.
       */
      this.client.subscriptions.subscribe('group-member-update', this.id.toString(), async message => {
        try {
          const member = message.content;

          if (member.user_id !== this.userId) return;

          this.client.logger.info(`[GROUP-${this.id}] Membership updated.`);
          const group = await this.client.api.getGroupInfo(this.id);

          if (typeof group === 'undefined') {
            this.client.logger.error(`[GROUP-${this.id}] Couldn't get group info.`);
            return;
          }

          this.updateGroup(group, member);
        } catch (error) {
          this.client.logger.error(`Error while handling group member update: ${(error as Error).message}`);
        }
      }),

      /**
       * Subscribe to server status changes, such as number of players and online or
       * offline state.
       */
      this.client.subscriptions.subscribe('group-server-status', this.id.toString(), async message => {
        try {
          const status = message.content;

          this.client.logger.debug(
            `[GROUP-${this.id}] Status updated for server ${status.id} (${status.name}).`,
            JSON.stringify(status)
          );
          this.manageServerConnection(status);
        } catch (error) {
          this.client.logger.error(
            `[GROUP-${this.id}] Error while handling server update: ${(error as Error).message}`
          );
        }
      }),

      /**
       * Subscribe to server heartbeats for accurate online/offline status.
       */
      this.client.subscriptions.subscribe('group-server-heartbeat', this.id.toString(), async message => {
        try {
          const status = message.content;

          this.client.logger.debug(
            `[GROUP-${this.id}] Heartbeat for server ${status.id} (${status.name}).`,
            JSON.stringify(status)
          );
          this.handleHeartbeat(status);
        } catch (error) {
          this.client.logger.error(
            `[GROUP-${this.id}] Error while handling server heartbeat: ${(error as Error).message}`
          );
        }
      }),

      /**
       * Subscribe to servers being created in this group.
       *
       * WARNING: This subscription is untested because currently only developers are
       * capable of creating servers. Currently, all groups have a single server but
       * it's possible that in the future any single group can have more than one
       * server that may be created by players themselves.
       */
      this.client.subscriptions.subscribe('group-server-create', this.id.toString(), _unstableMessage => {
        try {
          /* ⚠️ This code is untested because I can't create new servers. */
          this.client.logger.warn(
            `[GROUP-${this.id}] Client is running untested group-server-create code in Group.ts.`,
            JSON.stringify(_unstableMessage)
          );
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const serverId = _unstableMessage.content.id as number;
          this.addServer(serverId);
        } catch (error) {
          this.client.logger.error(
            `[GROUP-${this.id}] Error while handling server creation: ${(error as Error).message}`
          );
        }
      }),

      /**
       * Subscribe to servers being deleted in this group.
       *
       * WARNING: This subscription is untested because currently only developers are
       * capable of deleting servers. Currently, all groups have a single server but
       * it's possible that in the future any single group can have more than one
       * server that may be deleted by players themselves.
       */
      this.client.subscriptions.subscribe('group-server-delete', this.id.toString(), _unstableMessage => {
        try {
          /* ⚠️ This code is untested because I can't delete servers. */
          this.client.logger.warn(
            `[GROUP-${this.id}] Client is running untested group-server-delete code in Group.ts.`,
            JSON.stringify(_unstableMessage)
          );
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const serverId = _unstableMessage.content.id as number;
          this.removeServer(serverId);
        } catch (error) {
          this.client.logger.error(
            `[GROUP-${this.id}] Error while handling server deletion: ${(error as Error).message}`
          );
        }
      })
    ]);

    await this.updateServers();
  }

  /**
   * Updates all managed servers with new server info.
   */
  private async updateServers() {
    return await Promise.all(Object.values(this.servers).map(server => this.updateServer(server.id)));
  }

  /**
   * Updates a server with new server info.
   */
  private async updateServer(serverId: number) {
    this.client.logger.debug(`[GROUP-${this.id}] Updating info for server ${serverId}.`);
    const status = await this.client.api.getServerInfo(serverId);

    if (typeof status === 'undefined') {
      this.client.logger.error(`[GROUP-${this.id}] Couldn't get status for server ${serverId} (${this.name}).`);
      return;
    }

    this.manageServerConnection(status);
  }

  /**
   * Updates the group's details.
   */
  private async updateGroup(group: GroupInfo, member?: GroupMemberInfo) {
    this.name = group.name ?? this.name;
    this.description = group.description ?? this.description;
    this.roles =
      group.roles?.map(role => ({ id: role.role_id, name: role.name ?? '', permissions: role.permissions })) ??
      this.roles;

    if (typeof member !== 'undefined') {
      await this.updatePermissions(group, member);
    }

    this.emit('update', this);
  }

  /**
   * Updates this client's permissions for the given group with the given member info.
   */
  private async updatePermissions(group: GroupInfo, member: GroupMemberInfo) {
    const previousPermissions = [...this.permissions];
    this.permissions = this.getPermissions(group, member);

    if (!previousPermissions.includes('Console') && this.permissions.includes('Console')) {
      this.client.logger.info(`[GROUP-${this.id}] Client gained console access to servers in group.`);
    } else if (previousPermissions.includes('Console') && !this.permissions.includes('Console')) {
      this.client.logger.info(`[GROUP-${this.id}] Client lost console access to servers in group.`);
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
   * Tracks server heartbeats.
   */
  private async handleHeartbeat(status: ServerInfo) {
    if (status.is_online) {
      this.missedHeartbeats = 0;
      clearInterval(this.keepAlive);

      const serverId = status.id;
      const server = await this.ensureServer(serverId);

      if (typeof server === 'undefined') {
        this.client.logger.error(`[GROUP-${this.id}] Server ${serverId} not found in group.`);
        return;
      }

      this.keepAlive = setInterval(() => {
        this.client.logger.info(
          `[GROUP-${this.id}] No heartbeat received for server ${serverId} (${server.name}) in the last ${
            this.client.config.serverHeartbeatInterval * ++this.missedHeartbeats
          } ms.`
        );

        if (this.missedHeartbeats >= this.client.config.maxMissedServerHeartbeats) {
          this.client.logger.info(
            `[GROUP-${this.id}] Maximum missed heartbeats reached for server ${serverId} (${server.name}). Closing connection.`
          );

          server.disconnect();
          clearInterval(this.keepAlive);
        }
      }, this.client.config.serverHeartbeatInterval);
    }

    this.manageServerConnection(status);
  }

  /**
   * Connects or disconnects a server based on its online status.
   */
  private async manageServerConnection(status: ServerInfo) {
    const serverId = status.id;
    const server = await this.ensureServer(serverId);

    if (typeof server === 'undefined') {
      this.client.logger.error(`[GROUP-${this.id}] Server ${serverId} not found in group.`);
      return;
    }

    const hasConsolePermission = this.permissions.includes('Console');
    const isSupportedServerFleet = this.client.config.supportedServerFleets.includes(server.fleet);
    const mayConnect = hasConsolePermission && isSupportedServerFleet;
    const isServerOnline = status.is_online;
    const hasOnlinePlayers = status.online_players.length > 0;

    if (server.status === 'disconnected' && mayConnect && isServerOnline && hasOnlinePlayers) {
      try {
        await server.connect();
      } catch (error) {
        this.client.logger.error(
          `[GROUP-${this.id}] Couldn't connect to server ${serverId}: ${(error as Error).message}`
        );
      }
    } else if (server.status !== 'disconnected' && (!mayConnect || !isServerOnline)) {
      clearInterval(this.keepAlive);
      server.disconnect();
    }

    server.update(status);
  }

  /**
   * Starts managing all servers listed in a given group info.
   */
  private addServers(group: GroupInfo) {
    this.client.logger.debug(`[GROUP-${this.id}] Adding all servers for group.`);

    for (const server of group.servers ?? []) {
      this.addServer(server.id);
    }
  }

  /**
   * Starts managing the given server.
   */
  private async addServer(serverId: number) {
    this.client.logger.info(`[GROUP-${this.id}] Managing server ${serverId} (${this.name}).`);
    try {
      if (Object.keys(this.servers).map(Number).includes(serverId)) {
        throw new Error(`[GROUP-${this.id}] Can't add server ${serverId} (${this.name}) more than once.`);
      }

      const server = await this.client.api.getServerInfo(serverId);
      const managedServer = new Server(this, server);

      this.servers = {
        ...this.servers,
        [serverId]: managedServer
      } as Servers;

      this.emit('server-add', managedServer);

      this.manageServerConnection(server);

      return managedServer;
    } catch (error) {
      this.client.logger.error(
        `[GROUP-${this.id}] Couldn't add server ${serverId} to group: ${(error as Error).message}`
      );
    }

    return;
  }

  /**
   * Removes all managed servers from this group.
   */
  private removeServers() {
    this.client.logger.debug(`[GROUP-${this.id}] Removing all servers from group.`);

    for (const server of Object.values(this.servers)) {
      this.removeServer(server.id);
    }
  }

  /**
   * Removes the given managed server from this group.
   */
  private removeServer(serverId: number) {
    this.client.logger.info(`[GROUP-${this.id}] Removing server ${serverId} (${this.name}).`);

    const server = this.servers[serverId];

    if (typeof server === 'undefined') {
      this.client.logger.error(
        `[GROUP-${this.id}] Can't remove an unmanaged server with ID ${serverId} (${this.name}).`
      );
      return;
    }

    server.dispose();
    delete this.servers[serverId];
  }

  /**
   * Attempts to ensure a server is managed before doing anything with it.
   */
  private async ensureServer(serverId: number) {
    let server = this.servers[serverId];

    if (typeof server === 'undefined') {
      this.client.logger.error(
        `[GROUP-${this.id}] Server ${serverId} not found in group. Attempting to re-add server to group.`
      );

      server = await this.addServer(serverId);
    }

    return server;
  }

  /**
   * Disposes of this group. Tears down all managed servers and subscriptions.
   */
  async dispose() {
    clearInterval(this.keepAlive);
    this.removeServers();

    await Promise.all([
      this.client.subscriptions.unsubscribe('group-update', this.id.toString()),
      this.client.subscriptions.unsubscribe('group-server-create', this.id.toString()),
      this.client.subscriptions.unsubscribe('group-server-delete', this.id.toString()),
      this.client.subscriptions.unsubscribe('group-server-status', this.id.toString()),
      this.client.subscriptions.unsubscribe('group-server-heartbeat', this.id.toString()),
      this.client.subscriptions.unsubscribe('group-member-update', this.id.toString())
    ]);
  }
}
