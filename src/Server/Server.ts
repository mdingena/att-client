import type { Api } from '../Api';
import type { Group } from '../Group';
import type { Logger } from '../Logger';
import { ServerConnection } from '../ServerConnection';

export class Server {
  groupId: number;
  id: number;
  parent: Group;
  status: 'disconnected' | 'connecting' | 'connected';

  private api: Api;
  private connection?: ServerConnection;
  private logger: Logger;

  constructor(parent: Group, serverId: number) {
    this.logger = parent.parent.logger;

    this.api = parent.parent.api;
    this.groupId = parent.id;
    this.id = serverId;
    this.parent = parent;
    this.status = 'disconnected';
  }

  /**
   * Retrieves a server's connection details and establish a console connection.
   */
  async connect() {
    if (typeof this.connection !== 'undefined') {
      this.logger.error(`Can't open a second connection to server ${this.id}'s console.`);
      return;
    }

    const connectionDetails = await this.api.getServerConnectionDetails(this.id);

    if (typeof connectionDetails === 'undefined') {
      this.logger.error(`Couldn't get connection details for server ${this.id}.`);
      return;
    }

    this.logger.debug(`Got connection details for server ${this.id}.`, connectionDetails);

    const {
      allowed,
      connection: { address, websocket_port: port },
      token
    } = connectionDetails;

    if (!allowed) {
      this.logger.error(
        `This client is not allowed to use server ${this.id}'s console. Check that the bot account for this client was granted "Console" permissions.`
      );
      return;
    }

    this.status = 'connecting';
    const that = this;

    function handleError(error: Error) {
      that.logger.error(`Error on console connection on server ${that.id}.`, error);
    }

    function handleOpen() {
      that.logger.info(`Console connection opened on server ${that.id}.`);
      that.status = 'connected';
      that.parent.parent.emit('connect', connection);
    }

    function handleClose(code?: number, reason?: Buffer) {
      connection.off('open', handleOpen);
      that.logger.info(`Console connection closed on server ${that.id}.`, code, reason?.toString());
      that.status = 'disconnected';
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

    this.logger.debug(`Closing console connection to server ${this.id}.`);
    this.connection.dispose();
    delete this.connection;
  }

  /**
   * Disposes of this server. Tears down its console connection.
   */
  dispose() {
    this.disconnect();
  }
}
