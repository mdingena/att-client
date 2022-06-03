import type { Client } from '../Client';
import type { Logger } from '../Logger';
import type { ClientEvent } from './ClientEvent';
import type { ClientEventMessage } from './ClientEventMessage';
import type { ClientErrorMessage } from './ClientErrorMessage';
import type { ClientResponseMessage } from './ClientResponseMessage';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { HttpMethod, HttpResponseCode } from '../Api';
import {
  WEBSOCKET_MIGRATION_HANDOVER_PERIOD,
  WEBSOCKET_MIGRATION_INTERVAL,
  WEBSOCKET_PING_INTERVAL,
  WEBSOCKET_URL,
  X_API_KEY
} from '../constants';

export class Subscriptions {
  parent: Client;

  private clientId: string;
  private events: EventEmitter;
  private logger: Logger;
  private messageId: number;
  private migration: Promise<void>;
  private subscriptions: string[];
  private ws?: WebSocket;

  constructor(parent: Client) {
    this.clientId = parent.config.clientId;
    this.events = new EventEmitter();
    this.logger = parent.logger;
    this.parent = parent;
    this.migration = Promise.resolve();
    this.messageId = 1;
    this.subscriptions = [];
  }

  /**
   * Initialises a WebSocket connection with the Alta server.
   */
  async init() {
    if (typeof this.parent.accessToken === 'undefined') {
      this.logger.error("Can't initialise subscriptions without an access token.");
      return;
    }

    this.ws = await this.createWebSocket(this.parent.accessToken);

    await this.registerEventHandlers(this.ws);
  }

  /**
   * Creates a new WebSocket instance.
   */
  private async createWebSocket(accessToken: string): Promise<WebSocket> {
    this.logger.debug('Creating new WebSocket.');

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': X_API_KEY,
      'User-Agent': this.clientId,
      'Authorization': `Bearer ${accessToken}`
    };
    this.logger.debug('Configured WebSocket headers.', headers);

    const ws = new WebSocket(WEBSOCKET_URL, { headers });
    this.logger.debug('Created new WebSocket.', ws);

    setTimeout(this.migrate, WEBSOCKET_MIGRATION_INTERVAL);

    return ws;
  }

  /**
   * Takes a WebSocket instance and registers event handlers and timers to manage it.
   */
  private registerEventHandlers(ws: WebSocket): Promise<void> {
    return new Promise(resolve => {
      const that = this;
      let interval: NodeJS.Timer;

      function handleError(this: WebSocket, error: Error) {
        that.logger.error('An error occurred on the WebSocket.', error);
      }

      function handlePing(this: WebSocket, data: Buffer) {
        that.logger.debug('Received WebSocket ping.', data.toString());
        this.pong(data);
      }

      function handlePong(this: WebSocket, data: Buffer) {
        that.logger.debug('Received WebSocket pong.', data.toString());
      }

      function handleClose(this: WebSocket, code: number, reason: Buffer) {
        that.logger.debug(`WebSocket is closing with code ${code}: ${reason.toString()}`);

        this.off('error', handleError);
        this.off('ping', handlePing);
        this.off('pong', handlePong);

        clearInterval(interval);
      }

      function handleMessage(this: WebSocket, data: Buffer, isBinary: boolean) {
        if (isBinary) {
          // This should never happen. There is no Alta documentation about binary data being sent through WebSockets.
          that.logger.error('Puking horses! 🐴🐴🤮'); // https://thepetwiki.com/wiki/do_horses_vomit/
          return that.logger.debug('Received binary data on WebSocket.', data);
        }

        const message = JSON.parse(data.toString());
        that.logger.debug(`Received ${message.event} message with ID ${message.id}.`, message);

        if (typeof message.id === 'undefined' && /^Internal Server Error$/i.test(message.message)) {
          that.logger.error('Received an internal server error message.', message.message);
          return;
        }

        const eventName = message.id === 0 ? `${message.event}/${message.key}` : `message-${message.id}`;
        that.events.emit(eventName, {
          ...message,
          content: message.content.length > 0 ? JSON.parse(message.content) : message.content
        });
      }

      function handleOpen(this: WebSocket) {
        that.logger.debug('WebSocket opened.');

        that.logger.debug('Registering WebSocket event handlers.');
        this.on('error', handleError);
        this.on('ping', handlePing);
        this.on('pong', handlePong);
        this.on('message', handleMessage);

        that.logger.debug('Registering WebSocket ping interval.');
        interval = setInterval(() => {
          that.ping(ws);
        }, WEBSOCKET_PING_INTERVAL);

        resolve();
      }

      ws.once('close', handleClose);
      ws.once('open', handleOpen);
    });
  }

  /**
   * Sends a ping on the WebSocket.
   */
  private ping(ws: WebSocket) {
    this.logger.debug('Pinging WebSocket.');
    ws.ping(this.clientId);
  }

  /**
   * Migrates the WebSocket. Instructs the Alta server to migrate all existing subscriptions to a new connection.
   */
  async migrate() {
    await this.migration; // Prevent parallel migrations.

    if (typeof this.ws === 'undefined') {
      this.logger.error('There is no WebSocket to migrate.');
      return;
    }

    if (typeof this.parent.accessToken === 'undefined') {
      this.logger.error("Can't initialise subscriptions without an access token.");
      return;
    }

    this.logger.info('Beginning WebSocket migration.');

    this.logger.debug('Retrieving migration token.');
    const requestMigrateResponse = await this.send('GET', 'migrate');

    if (typeof requestMigrateResponse === 'undefined') {
      this.logger.error('Client failed to migrate WebSocket.');
      return;
    }

    const { token } = requestMigrateResponse.content;
    this.logger.debug('Received migration token.', token);

    const oldWs = this.ws;
    this.migration = this.replaceWebSocket(oldWs, token);

    return this.migration;
  }

  /**
   * Performs the actual WebSocket migration, whereas migrate() is the public method to kick off the process and
   * manage this class's internal state and queuing messages during the migration.
   */
  private async replaceWebSocket(oldWs: WebSocket, token: string) {
    delete this.ws;

    await this.init();
    await this.send('POST', 'migrate', { token });
    await new Promise(resolve => {
      this.logger.info(
        `Successfully migrated WebSocket. Gracefully shutting down old WebSocket in ${WEBSOCKET_MIGRATION_HANDOVER_PERIOD} ms.`
      );

      setTimeout(() => {
        oldWs.close(1000, 'Migration completed.');
        this.logger.info(`Closed old WebSocket.`);

        resolve(true);
      }, WEBSOCKET_MIGRATION_HANDOVER_PERIOD);
    });
  }

  /**
   * Gets a unique WebSocket message ID.
   */
  private getMessageId() {
    return this.messageId++;
  }

  /**
   * Sends a WebSocket request and returns a Promise of the response.
   */
  private async send<M extends HttpMethod, P extends string>(method: M, path: P, payload?: Record<string, unknown>) {
    if (path !== 'migrate') await this.migration;

    return new Promise(
      (
        resolve: (message: ClientResponseMessage<`${M} /ws/${P}`>) => void,
        reject: (error?: ClientErrorMessage) => void
      ) => {
        if (typeof this.parent.accessToken === 'undefined' || typeof this.ws === 'undefined') {
          this.logger.error(
            'Subscriptions has invalid internals. Did you initialise Subscriptions with a valid access token and decoded token?'
          );
          this.logger.debug('Subscriptions.accessToken', this.parent.accessToken);
          this.logger.debug('Subscriptions.ws', this.ws);

          reject(this.createErrorMessage("Can't send message on WebSocket."));
          return;
        }

        const id = this.getMessageId();

        this.logger.debug(`Registering one-time event handler for message-${id}.`);
        this.events.once(`message-${id}`, (message: ClientResponseMessage<`${M} /ws/${P}`> | ClientErrorMessage) => {
          if (message.responseCode === HttpResponseCode.Ok) {
            resolve(message as ClientResponseMessage<`${M} /ws/${P}`>);
          } else {
            reject(message as ClientErrorMessage);
            return;
          }
        });

        const message = {
          method,
          path,
          authorization: `Bearer ${this.parent.accessToken}`,
          id,
          content: JSON.stringify(payload)
        };

        this.logger.debug('Sending message.', message);
        this.ws.send(
          JSON.stringify(message),
          error => typeof error !== 'undefined' && reject(this.createErrorMessage(error.message))
        );
      }
    ).catch((message: ClientErrorMessage) => {
      this.logger.error('Error:', message.content.message);
    });
  }

  /**
   * Subscribes to an account message and registers a callback for it.
   */
  subscribe<T extends ClientEvent>(event: T, key: string, callback: (message: ClientEventMessage<T>) => void) {
    const subscription = `${event}/${key}`;

    if (this.subscriptions.includes(subscription)) {
      this.logger.error(`Already subscribed to ${subscription}.`);
      return;
    }

    this.logger.debug(`Subscribing to ${subscription}.`);
    this.subscriptions = [...this.subscriptions, subscription];
    this.events.on(subscription, callback);

    return this.send('POST', `subscription/${subscription}`);
  }

  /**
   * Unsubscribes to an account message and removes all callbacks for it.
   */
  unsubscribe<T extends ClientEvent>(event: T, key: string) {
    const subscription = `${event}/${key}`;

    if (!this.subscriptions.includes(subscription)) {
      this.logger.error(`Subscription to ${subscription} does not exist.`);
      return;
    }

    this.logger.debug(`Unsubscribing to ${subscription}.`);
    this.subscriptions = this.subscriptions.filter(existing => existing !== subscription);
    this.events.removeAllListeners(subscription);

    return this.send('DELETE', `subscription/${subscription}`);
  }

  /**
   * Creates a custom error message that mimics a WebSocket message shape.
   */
  private createErrorMessage(reason: string, code?: number | string): ClientErrorMessage {
    return {
      id: 0,
      event: 'response',
      key: 'INTERNAL_ERROR',
      responseCode: 0,
      content: { message: reason, error_code: code?.toString() ?? 'None' }
    };
  }
}
