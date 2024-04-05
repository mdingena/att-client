import type { ServerFleet, ServerInfo } from '../Api/index.js';
import type { Group } from '../Group/index.js';
import { TypedEmitter } from '@mdingena/tiny-typed-emitter';
import { ServerConnection } from '../ServerConnection/index.js';

type Player = {
  id: number;
  username: string;
};

interface Events {
  connect: (serverConnection: ServerConnection) => void;
  update: (server: Server) => void;
}

export class Server extends TypedEmitter<Events> {
  description: string;
  group: Group;
  id: number;
  name: string;
  playability: number;
  players: Player[];
  status: 'disconnected' | 'connecting' | 'connected';
  fleet: ServerFleet;

  private connection?: ServerConnection;

  constructor(group: Group, server: ServerInfo) {
    super();

    this.description = server.description ?? '';
    this.fleet = server.fleet;
    this.group = group;
    this.id = server.id;
    this.name = server.name ?? group.name ?? '';
    this.playability = server.playability;
    this.players = server.online_players;
    this.status = 'disconnected';

    this.emit('update', this);
  }

  /**
   * Retrieves a server's connection details and establish a console connection.
   */
  async connect(): Promise<ServerConnection> {
    this.status = 'connecting';

    if (typeof this.connection !== 'undefined') {
      throw new Error(`[SERVER-${this.id}] Can't open a second console connection.`);
    }

    const serverConnectionInfo = await this.group.client.api.getServerConnectionDetails(this.id);

    if ('ok' in serverConnectionInfo) {
      throw new Error(`[SERVER-${this.id}] Couldn't get connection details.`);
    }

    return await new Promise<ServerConnection>((resolve, reject) => {
      this.group.client.logger.debug(
        `[SERVER-${this.id}] Got connection details.`,
        JSON.stringify(serverConnectionInfo)
      );

      const { allowed, connection: connectionDetails, token } = serverConnectionInfo;

      if (typeof connectionDetails === 'undefined') {
        return reject(
          new Error(`[SERVER-${this.id}] Console WebSocket details are missing. ${serverConnectionInfo.message}`)
        );
      }

      if (typeof token === 'undefined') {
        return reject(new Error(`[SERVER-${this.id}] Console WebSocket token is missing.`));
      }

      if (!allowed) {
        return reject(
          new Error(
            `[SERVER-${this.id}] Client is not allowed to use this server's console. Check that the bot account for this client was granted "Console" permissions.`
          )
        );
      }

      const { address, websocket_port: port } = connectionDetails;

      const that = this;

      function handleError(this: ServerConnection, error: Error) {
        that.group.client.logger.error(`[SERVER-${that.id}] Error on console connection.`, error.message);

        /**
         * If errors happen before the WebSocket connection is opened, it's likely
         * that the WebSocket won't open anymore. In this case we want to reject
         * the pending Server.connect() promise.
         *
         * In other cases, errors will happen during a connection. If that results
         * in the WebSocket closing, we can handle this in the onClose handler,
         * because supposedly not all errors result in a disconnect.
         */
        if (that.status !== 'connected') {
          reject(error);
        }
      }

      function handleOpen(this: ServerConnection) {
        that.group.client.logger.info(`[SERVER-${that.id}] Console connection opened.`);
        that.status = 'connected';
        that.emit('connect', this);
        that.group.client.emit('connect', this);
        resolve(this);
      }

      async function handleClose(this: ServerConnection, code?: number, reason?: Buffer) {
        if (code === 1000) {
          that.disconnect();
        } else {
          /* Reconnect console connection when closed unexpectedly. */
          that.group.client.logger.info(`[SERVER-${that.id}] Console connection closed.`, code, reason?.toString());

          await that.reconnect();
        }
      }

      const connection = new ServerConnection(this, address, port, token);

      connection.on('error', handleError.bind(connection));
      connection.once('close', handleClose.bind(connection));
      connection.once('open', handleOpen.bind(connection));

      this.connection = connection;
    });
  }

  /**
   * Closes this server's console connection.
   */
  disconnect() {
    if (typeof this.connection === 'undefined') return;

    this.group.client.logger.info(`[SERVER-${this.id}] Closing console connection.`);
    this.connection.dispose();
    delete this.connection;
    this.status = 'disconnected';
  }

  /**
   * Reconnects to this server's console connection after the configured delay.
   */
  private async reconnect() {
    if (typeof this.connection === 'undefined') return;

    this.disconnect();

    this.group.client.logger.info(
      `[SERVER-${this.id}] Reopening console connection in ${this.group.client.config.serverConnectionRecoveryDelay} ms.`
    );

    await new Promise(resolve => setTimeout(resolve, this.group.client.config.serverConnectionRecoveryDelay));

    try {
      await this.connect();
    } catch (error) {
      this.group.client.logger.error((error as Error).message);
      await this.reconnect();
    }
  }

  /**
   * Updates this server with new information.
   */
  update(status: ServerInfo) {
    this.description = status.description;
    this.name = status.name;
    this.playability = status.playability;
    this.players = status.online_players;
    this.fleet = status.fleet;

    this.emit('update', this);
  }

  /**
   * Disposes of this server. Tears down its console connection.
   */
  dispose() {
    this.disconnect();
  }
}
