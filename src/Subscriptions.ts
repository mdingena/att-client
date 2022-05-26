import type { HttpMethod } from './HttpMethod';
import type { Message } from './Message';
import { EventEmitter } from 'stream';
import { WebSocket } from 'ws';
import { Logger, Verbosity } from './Logger';
import { HttpResponseCode } from './HttpResponseCode';
import { WEBSOCKET_PING_INTERVAL, WEBSOCKET_URL, X_API_KEY } from './constants';

export const enum Subscription {
  GroupInvitationRequested = 'me-group-invite-create',
  GroupInvitationRevoked = 'me-group-invite-delete',
  JoinedGroup = 'me-group-create',
  LeftGroup = 'me-group-delete'
}

export class Subscriptions extends EventEmitter {
  accessToken?: string;
  clientId: string;
  events: EventEmitter;
  logger: Logger;
  messageId: number;
  ws?: WebSocket;

  constructor(clientId: string, logger: Logger = new Logger(Verbosity.Warning)) {
    super();

    this.clientId = clientId;
    this.events = new EventEmitter();
    this.logger = logger;
    this.messageId = 1;
  }

  async init(accessToken: string) {
    this.accessToken = accessToken;

    this.ws = await this.createWebSocket(accessToken);

    this.registerEventHandlers(this.ws);
  }

  /**
   * Creates a new WebSocket instance.
   */
  private async createWebSocket(accessToken: string): Promise<WebSocket> {
    this.logger.info('Creating new WebSocket.');

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
  //     return this.logger.error('There is no WebSocket to destroy.');
  //   }

  //   this.webSocket.removeAllListeners();

  //   delete this.webSocket;
  // }

  /**
   * Takes a WebSocket instance and registers event handlers and timers to manage it.
   */
  private registerEventHandlers(ws: WebSocket): void {
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
      that.logger.debug('Received WebSocket message.', message);

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

      that.emit('ready', that);
    }

    ws.once('close', handleClose);
    ws.once('open', handleOpen);
  }

  /**
   * Send a ping to whatever WS we currently have.
   */
  private ping(ws: WebSocket) {
    this.logger.debug('Sending WebSocket ping.');
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
  private send<T>(method: HttpMethod, path: string, payload?: { [key: string]: unknown }) {
    return new Promise((resolve: (message: Message<T>) => void, reject: (error?: Error | Message<T>) => void) => {
      if (typeof this.accessToken === 'undefined' || typeof this.ws === 'undefined') {
        this.logger.error(
          'Subscriptions has invalid internals. Did you initialise Subscriptions with a valid access token and decoded token?'
        );
        this.logger.debug('Subscriptions.accessToken', this.accessToken);
        this.logger.debug('Subscriptions.ws', this.ws);

        throw new Error("Can't send message on WebSocket.");
      }

      const id = this.getMessageId();

      this.logger.debug(`Registering one-time event handler for message-${id}.`);
      this.events.once(`message-${id}`, function (message: Message<T>) {
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

      this.logger.debug('Sending WebSocket message.', message);
      this.ws.send(JSON.stringify(message), error => typeof error !== 'undefined' && reject(error));
    });
  }

  subscribe<T extends Subscription>(event: T, key: string, callback: (message: Message<T>) => unknown) {
    const subscription = `${event}/${key}`;

    this.logger.debug(`Subscribing to ${subscription}.`);
    this.events.on(subscription, callback);

    return this.send<typeof event>('POST', `subscription/${subscription}`);
  }

  unsubscribe<T extends Subscription>(event: T, key: string, callback: (message: Message<T>) => unknown) {
    const subscription = `${event}/${key}`;

    this.logger.debug(`Unsubscribing to ${subscription}.`);
    this.events.off(subscription, callback);

    return this.send<T>('DELETE', `subscription/${subscription}`);
  }
}
