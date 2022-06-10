import type { Api, ServerInfo } from '../Api';
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
  fleet: string;

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
  async connect() {
    if (typeof this.connection !== 'undefined') {
      this.logger.error(`Can't open a second connection to server ${this.id}'s (${this.name}) console.`);
      return;
    }

    const connectionDetails = await this.api.getServerConnectionDetails(this.id);

    if (typeof connectionDetails === 'undefined') {
      this.logger.error(`Couldn't get connection details for server ${this.id} (${this.name}).`);
      return;
    }

    this.logger.debug(`Got connection details for server ${this.id} (${this.name}).`, connectionDetails);

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

    this.status = 'connecting';
    const that = this;

    function handleError(error: Error) {
      that.logger.error(`Error on console connection on server ${that.id} (${that.name}).`, error);
    }

    function handleOpen() {
      that.logger.info(`Console connection opened on server ${that.id} (${that.name}).`);
      that.status = 'connected';
      that.group.client.emit('connect', connection);
    }

    function handleClose(code?: number, reason?: Buffer) {
      connection.off('open', handleOpen);
      that.logger.info(`Console connection closed on server ${that.id} (${that.name}).`, code, reason?.toString());
      that.status = 'disconnected';
      that.disconnect();
    }

    const connection = new ServerConnection(this, address, port, token);

    connection.on('error', handleError);
    connection.once('close', handleClose);
    connection.once('open', handleOpen);

    this.connection = connection;
  }

  /**
   * Closes this server's console connection.
   */
  disconnect() {
    if (typeof this.connection === 'undefined') return;

    this.logger.info(`Closing console connection to server ${this.id} (${this.name}).`);
    this.connection.dispose();
    delete this.connection;
  }

  /**
   * Updates a server with new information.
   */
  update(status: ServerInfo) {
    this.description = status.description;
    this.name = status.name;
    this.playability = status.playability;
    this.players = status.online_players;

    this.emit('update', this);
  }

  /**
   * Disposes of this server. Tears down its console connection.
   */
  dispose() {
    this.disconnect();
  }
}
