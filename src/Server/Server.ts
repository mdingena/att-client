import type { Api, ServerFleet, ServerInfo } from '../Api';
import type { Group } from '../Group';
import type { Logger } from '../Logger';
import { TypedEmitter } from 'tiny-typed-emitter';
import { ServerConnection } from '../ServerConnection';

type Player = {
  id: number;
  username: string;
};

interface Events {
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

  private api: Api;
  private connection?: ServerConnection;
  private logger: Logger;

  constructor(group: Group, server: ServerInfo) {
    super();

    this.logger = group.client.logger;

    this.api = group.client.api;
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
  async connect(): Promise<void> {
    if (typeof this.connection !== 'undefined') {
      this.logger.error(`Can't open a second connection to server ${this.id}'s (${this.name}) console.`);
      return;
    }

    const connectionDetails = await this.api.getServerConnectionDetails(this.id);

    if (typeof connectionDetails === 'undefined') {
      this.logger.error(`Couldn't get connection details for server ${this.id} (${this.name}).`);
      return;
    }

    this.logger.debug(
      `Got connection details for server ${this.id} (${this.name}).`,
      JSON.stringify(connectionDetails)
    );

    const {
      allowed,
      connection: { address, websocket_port: port },
      token
    } = connectionDetails;

    if (!allowed) {
      this.logger.error(
        `This client is not allowed to use server ${this.id}'s (${this.name}) console. Check that the bot account for this client was granted "Console" permissions.`
      );
      return;
    }

    const that = this;

    try {
      await new Promise<void>((resolve, reject) => {
        function handleError(this: ServerConnection, error: Error) {
          that.logger.error(`Error on console connection on server ${that.id} (${that.name}).`, error.message);

          /**
           * If errors happen before the WebSocket connection is opened, it's likely
           * that the WebSocket won't open anymore. In this case we want to reject
           * so that we can trigger a recovery.
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
          that.logger.info(`Console connection opened on server ${that.id} (${that.name}).`);
          that.status = 'connected';
          that.group.client.emit('connect', this);
          resolve();
        }

        async function handleClose(this: ServerConnection, code?: number, reason?: Buffer) {
          if (code === 1000) {
            that.disconnect();
          } else {
            /* Reconnect console connection when closed unexpectedly. */
            that.logger.info(
              `Console connection closed on server ${that.id} (${that.name}).`,
              code,
              reason?.toString()
            );

            await that.reconnect();
          }
        }

        this.status = 'connecting';

        const connection = new ServerConnection(this, address, port, token);

        connection.on('error', handleError.bind(connection));
        connection.once('close', handleClose.bind(connection));
        connection.once('open', handleOpen.bind(connection));

        this.connection = connection;
      });
    } catch (error) {
      this.logger.error(
        `Something went wrong opening a console connection to server ${this.name}: ${(error as Error).message}`
      );

      await this.reconnect();
    }
  }

  /**
   * Closes this server's console connection.
   */
  disconnect() {
    if (typeof this.connection === 'undefined') return;

    this.logger.info(`Closing console connection to server ${this.id} (${this.name}).`);
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

    this.logger.info(
      `Reopening console connection to server ${this.id} (${this.name}) in ${this.group.client.config.serverConnectionRecoveryDelay} ms.`
    );

    await new Promise(resolve => setTimeout(resolve, this.group.client.config.serverConnectionRecoveryDelay));
    await this.connect();
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
