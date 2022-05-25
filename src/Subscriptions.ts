import { EventEmitter } from 'stream';
import { WebSocket } from 'ws';
import { Logger, Verbosity } from './Logger';
import { WEBSOCKET_PING_INTERVAL, WEBSOCKET_URL, X_API_KEY } from './constants';

type HttpMethod = 'CONNECT' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | 'TRACE';

enum HttpResponseCode {
  Ok = 200,
  BadRequest = 400,
  NotAuthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  InternalServerError = 500,
  BadGateway = 502,
  ServiceUnavailable = 503
}

export type Message = {
  id: number;
  event: string;
  key: string;
  responseCode: number;
  content: string;
};

type Callback = (message: Message) => unknown;

export enum SubscriptionEvent {
  CreateGroup = 'me-group-create',
  DeleteGroup = 'me-group-delete',
  InviteToGroupRequest = 'me-group-invite-create',
  InviteToGroupRevoke = 'me-group-invite-delete',
  JoinGroupRequest = 'me-group-request-create',
  JoinGroupRevoke = 'me-group-request-delete'
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
        return that.logger.debug('Received binary data on WebSocket.', data);
      }

      const message = JSON.parse(data.toString()) as Message;
      that.logger.debug('Received WebSocket message.', message);

      if (message.id >= 0) that.events.emit(`message-${message.id}`, message);

      /* if (message.content.length > 0) */ that.events.emit(`${message.event}/${message.key}`);
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

  private send(method: HttpMethod, path: string, payload?: { [key: string]: unknown }) {
    return new Promise((resolve: (message: Message) => void, reject: (error?: Error | Message) => void) => {
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
      this.events.once(`message-${id}`, function (message: Message) {
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

  subscribe(callback: Callback, event: string, ...params: string[]) {
    const path = params.length ? `/${params.join('/')}` : '';
    const subscription = `${event}${path}`;

    this.logger.info(`Subscribing to ${subscription}.`);
    this.events.on(subscription, callback);

    return this.send('POST', `subscription/${subscription}`);
  }

  unsubscribe(callback: Callback, event: string, ...params: string[]) {
    const path = params.length ? `/${params.join('/')}` : '';
    const subscription = `${event}${path}`;

    this.logger.debug(`Unsubscribing to ${subscription}.`);
    this.events.off(subscription, callback);

    return this.send('DELETE', `subscription/${subscription}`);
  }
}
