import type { Client } from '../Client';
import type { Logger } from '../Logger';
import type { ClientEventMessage } from './ClientEventMessage';
import type { ClientEvent } from './ClientEvent';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { HttpMethod, HttpResponseCode } from '../Api';
import { WEBSOCKET_PING_INTERVAL, WEBSOCKET_URL, X_API_KEY } from '../constants';

export class Subscriptions {
  parent: Client;

  private accessToken?: string;
  private clientId: string;
  private events: EventEmitter;
  // private isMigrating: Promise<void>;
  private logger: Logger;
  private messageId: number;
  private subscriptions: string[];
  private ws?: WebSocket;

  constructor(parent: Client) {
    this.clientId = parent.config.clientId;
    this.events = new EventEmitter();
    // this.isMigrating = Promise.resolve();
    this.logger = parent.logger;
    this.parent = parent;
    this.messageId = 1;
    this.subscriptions = [];
  }

  async init(accessToken: string) {
    this.accessToken = accessToken;

    this.ws = await this.createWebSocket(accessToken);

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

    return ws;
  }

  /**
   * Destroys current WebSocket instance.
   */
  // private destroyWebSocket(): void {
  //   this.logger.info('Tearing down WebSocket instance.');

  //   if (typeof this.webSocket === 'undefined') {
  //     this.logger.error('There is no WebSocket to destroy.');
  //     return;
  //   }

  //   this.webSocket.removeAllListeners();

  //   delete this.webSocket;
  // }

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
        that.logger.warn(`WebSocket is closing with code ${code}: ${reason.toString()}.`);

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

        if (message.id === 0) {
          that.events.emit(`${message.event}/${message.key}`, {
            ...message,
            content: JSON.parse(message.content)
          });
        } else {
          that.events.emit(`message-${message.id}`, message);
        }
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
   * Send a ping to whatever WS we currently have.
   */
  private ping(ws: WebSocket) {
    this.logger.debug('Pinging WebSocket.');
    ws.ping(this.clientId);
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
  private send<T>(method: HttpMethod, path: string, payload?: Record<string, unknown>) {
    return new Promise(
      (resolve: (message: ClientEventMessage<T>) => void, reject: (error?: Error | ClientEventMessage<T>) => void) => {
        if (typeof this.accessToken === 'undefined' || typeof this.ws === 'undefined') {
          this.logger.error(
            'Subscriptions has invalid internals. Did you initialise Subscriptions with a valid access token and decoded token?'
          );
          this.logger.debug('Subscriptions.accessToken', this.accessToken);
          this.logger.debug('Subscriptions.ws', this.ws);

          reject(new Error("Can't send message on WebSocket."));
          return;
        }

        const id = this.getMessageId();

        this.logger.debug(`Registering one-time event handler for message-${id}.`);
        this.events.once(`message-${id}`, (message: ClientEventMessage<T>) => {
          if (message.responseCode === HttpResponseCode.Ok) {
            resolve(message);
          } else {
            reject(message);
          }
        });

        const message = {
          method,
          path,
          authorization: `Bearer ${this.accessToken}`,
          id,
          ...payload
        };

        this.logger.debug('Sending message.', message);
        this.ws.send(JSON.stringify(message), error => typeof error !== 'undefined' && reject(error));
      }
    );
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

    return this.send<T>('POST', `subscription/${subscription}`);
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

    return this.send<T>('DELETE', `subscription/${subscription}`);
  }
}
