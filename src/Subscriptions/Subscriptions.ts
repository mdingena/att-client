import type { Client } from '../Client';
import type { Logger } from '../Logger';
import type { ClientEvent } from './ClientEvent';
import type { ClientEventMessage } from './ClientEventMessage';
import type { ClientErrorMessage } from './ClientErrorMessage';
import type { ClientResponseMessage } from './ClientResponseMessage';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { HttpMethod, HttpResponseCode } from '../Api';

type SubscribeResult = void | ClientResponseMessage<`POST /ws/subscription/${ClientEvent}`>;

export class Subscriptions {
  client: Client;
  halted: Promise<void>;

  private events: EventEmitter;
  private logger: Logger;
  private messageId: number;
  private migrationDelay?: NodeJS.Timeout;
  private pingInterval?: NodeJS.Timer;
  private resolveMigration?: (value: void | PromiseLike<void>) => void;
  private subscriptions: Record<string, (message: ClientEventMessage<ClientEvent>) => void>;
  private ws?: WebSocket;

  constructor(client: Client) {
    this.events = new EventEmitter();
    this.logger = client.logger;
    this.client = client;
    this.halted = Promise.resolve();
    this.messageId = 1;
    this.subscriptions = {};
  }

  /**
   * Initialises a WebSocket connection with the Alta server.
   */
  async init() {
    if (typeof this.client.accessToken === 'undefined') {
      this.logger.error("Can't initialise subscriptions without an access token. Ordering client to refresh tokens.");
      await this.client.refreshTokens();
      await this.init();
      return;
    }

    this.ws = await this.createWebSocket(this.client.accessToken);

    await this.registerEventHandlers(this.ws);
  }

  /**
   * Creates a new WebSocket instance.
   */
  private async createWebSocket(accessToken: string): Promise<WebSocket> {
    this.logger.debug('Creating new WebSocket.');

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.client.config.xApiKey,
      'User-Agent': this.client.config.clientId,
      'Authorization': `Bearer ${accessToken}`
    };
    this.logger.debug('Configured WebSocket headers.', JSON.stringify(headers));

    const ws = new WebSocket(this.client.config.webSocketUrl, { headers });
    this.logger.debug('Created new WebSocket.');

    clearTimeout(this.migrationDelay);
    this.migrationDelay = setTimeout(this.migrate.bind(this), this.client.config.webSocketMigrationInterval);

    return ws;
  }

  /**
   * Takes a WebSocket instance and registers event handlers and timers to manage it.
   */
  private registerEventHandlers(ws: WebSocket): Promise<void> {
    return new Promise(resolve => {
      const that = this;

      function handleError(this: WebSocket, error: Error) {
        that.logger.error('An error occurred on the WebSocket.', error.message);
      }

      function handlePing(this: WebSocket, data: Buffer) {
        that.logger.debug('Received WebSocket ping.', data.toString());
        this.pong(data);
      }

      function handlePong(this: WebSocket, data: Buffer) {
        that.logger.debug('Received WebSocket pong.', data.toString());
      }

      async function handleClose(this: WebSocket, code: number, reason: Buffer) {
        that.logger.debug(`WebSocket is closing with code ${code}: ${reason.toString()}`);

        this.off('error', handleError);
        this.off('ping', handlePing);
        this.off('pong', handlePong);

        clearInterval(that.pingInterval);

        /* Migrations close WebSocket with code 3000 or 3001. */
        if (code !== 3000 && code !== 3001) {
          that.logger.error(`WebSocket closed abnormally with code ${code}: ${reason}`);
          that.logger.info('Restarting WebSocket and subscriptions.');

          await that.recoverWebSocket();
        }
      }

      function handleMessage(this: WebSocket, data: Buffer, isBinary: boolean) {
        if (isBinary) {
          // This should never happen. There is no Alta documentation about binary data being sent through WebSockets.
          that.logger.error('Puking horses! 🐴🐴🤮'); // https://thepetwiki.com/wiki/do_horses_vomit/
          that.logger.debug('Received binary data on WebSocket.', data.toString());
          return;
        }

        const message = JSON.parse(data.toString());

        /* Handle messages during migration. */
        if (typeof that.resolveMigration !== 'undefined') {
          that.events.emit('migrate', message);
          return;
        }

        if (typeof message.content === 'undefined') {
          that.logger.error(`Received a message with ID ${message.id} but no content.`, JSON.stringify(message));
          return;
        }

        that.logger.debug(`Received ${message.event} message with ID ${message.id}.`, JSON.stringify(message));

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
        clearInterval(that.pingInterval);
        that.pingInterval = setInterval(() => {
          that.ping(this);
        }, that.client.config.webSocketPingInterval);

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
    ws.ping(this.client.config.clientId);
  }

  /**
   * Migrates the WebSocket. Instructs the Alta server to migrate all existing subscriptions to a new connection.
   */
  async migrate(migrationToken?: string) {
    await this.halted;

    if (typeof this.ws === 'undefined') {
      this.logger.warn('There is no WebSocket to migrate. Creating new WebSocket.');
      await this.init();
      return;
    }

    if (typeof this.client.accessToken === 'undefined') {
      this.logger.warn("Can't migrate WebSocket without an access token. Ordering client to refresh tokens.");
      await this.client.refreshTokens();
      await this.migrate();
      return;
    }

    this.logger.info('Beginning WebSocket migration.');

    clearTimeout(this.migrationDelay);

    let token: string;

    if (typeof migrationToken === 'undefined') {
      this.logger.debug('Retrieving migration token.');
      const requestMigrateResponse = await this.send('GET', 'migrate');

      if (typeof requestMigrateResponse === 'undefined') {
        await this.retryMigration();
        return;
      }

      token = requestMigrateResponse.content.token;
      this.logger.debug('Received migration token.', token);
    } else {
      token = migrationToken;
      this.logger.debug('Reusing migration token.', token);
    }

    /* Track migration state. Will halt all outbound messages. */
    this.halted = new Promise(resolve => {
      this.resolveMigration = resolve;
    });

    /* Create a new WebSocket instance. */
    const oldWs = this.ws;
    delete this.ws;
    this.ws = await this.createWebSocket(this.client.accessToken);
    await this.registerEventHandlers(this.ws);

    /* Send the migration token over new WebSocket. */
    try {
      await this.sendMigrationToken(token);
    } catch (error) {
      clearInterval(this.pingInterval);
      this.ws.removeAllListeners();
      this.ws.close(3001, 'Migration aborted.');
      delete this.ws;
      this.ws = oldWs;
      this.clearMigration();
      await this.retryMigration(token);
      return;
    }

    /* Migration completed. Resume outbound messages. */
    this.clearMigration();

    /* Gracefully discard old WebSocket instance. */
    this.logger.info(
      `Successfully migrated WebSocket. Gracefully shutting down old WebSocket in ${this.client.config.webSocketMigrationHandoverPeriod} ms.`
    );

    await new Promise(resolve => setTimeout(resolve, this.client.config.webSocketMigrationHandoverPeriod));

    oldWs.close(3000, 'Migration completed.');
    oldWs.removeAllListeners();
    this.logger.info(`Closed old WebSocket.`);
  }

  /**
   * Sends a migration token over a given WebSocket instance and promises to handle its response.
   * Resolves when Alta responds with a successful migration message.
   * Rejects on all other cases.
   *
   * Should be used on a WebSocket without any `onMessage` handlers for best results, as Alta does not always
   * respond to requests with a message ID to allow us to correlate the response to our request.
   */
  private sendMigrationToken(token: string) {
    return new Promise((resolve, reject) => {
      this.events.once('migrate', message => {
        if (message.event === 'response' && message.responseCode === 200 && message.key === 'POST /ws/migrate') {
          resolve(message.content);
        } else {
          this.logger.error(
            'Something went wrong posting the WebSocket migration token. Received message:',
            JSON.stringify(message)
          );
          reject();
        }
      });

      this.send('POST', 'migrate', { token });
    });
  }

  /**
   * Retries a failed WebSocket migration after a configured delay.
   */
  private async retryMigration(migrationToken?: string) {
    this.logger.error(
      `Client failed to migrate WebSocket. Retrying in ${this.client.config.webSocketMigrationRetryDelay} ms.`
    );

    await new Promise(resolve => setTimeout(resolve, this.client.config.webSocketMigrationRetryDelay));

    await this.migrate(migrationToken);
  }

  /**
   * Clears any pending migration Promise, unblocking queued messages waiting for a WebSocket instance.
   */
  private clearMigration() {
    if (typeof this.resolveMigration !== 'undefined') {
      this.logger.debug('Resolving migration Promise.');
      this.resolveMigration();
      delete this.resolveMigration;
    }
  }

  /**
   * Recovers from an abnormally closed WebSocket connection.
   * This class should always maintain an active WebSocket. When the WebSocket is closed abnormally, this method
   * creates a new WebSocket and restores all subscriptions.
   */
  private async recoverWebSocket() {
    await this.halted;

    if (typeof this.client.accessToken === 'undefined') {
      this.logger.warn("Can't migrate WebSocket without an access token. Ordering client to refresh tokens.");
      await this.client.refreshTokens();
      await this.recoverWebSocket();
      return;
    }

    this.logger.info('Recovering WebSocket connection.');

    /* Track recovery state. Will halt all outbound messages. */
    this.halted = new Promise(resolve => {
      this.resolveMigration = resolve;
    });

    /* Create new WebSocket */
    delete this.ws;
    this.ws = await this.createWebSocket(this.client.accessToken);
    await this.registerEventHandlers(this.ws);

    /* Unblock all backed-up messages. */
    this.clearMigration();

    /* Save all tracked subscriptions and reset tracker. */
    const subscriptions = { ...this.subscriptions };
    this.subscriptions = {};

    /* Resubscribe to all saved subscriptions. */
    try {
      const resubscriptions = await Promise.race<PromiseSettledResult<SubscribeResult>[]>([
        Promise.allSettled<Promise<SubscribeResult>[]>(
          Object.entries(subscriptions).map(([entry, callback]) => {
            const [subscription, key] = entry.split('/') as [ClientEvent, string];

            if (typeof subscription !== 'string' || typeof key !== 'string') return Promise.resolve();

            this.events.removeAllListeners(entry);
            return this.subscribe(subscription, key, callback) ?? Promise.reject();
          })
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            reject(
              new Error(
                `WebSocket recovery failed! Resubscribing was unsuccessful within ${this.client.config.webSocketRecoveryTimeout} ms. Retrying recovery in ${this.client.config.webSocketRecoveryRetryDelay} ms.`
              )
            );
          }, this.client.config.webSocketRecoveryTimeout)
        )
      ]);

      /* Verify resubscriptions. */
      if (resubscriptions.some(resub => resub.status === 'rejected')) {
        throw new Error(
          `WebSocket recovery failed! Some resubscriptions were unsuccessful. Retrying recovery in ${this.client.config.webSocketRecoveryRetryDelay} ms.`
        );
      }
    } catch (error) {
      /* WebSocket recovery has failed. */
      this.halted = new Promise(resolve => {
        this.resolveMigration = resolve;
      });

      this.logger.error((error as Error).message);

      await new Promise(resolve => setTimeout(resolve, this.client.config.webSocketRecoveryRetryDelay));

      this.clearMigration();
      await this.recoverWebSocket();
    }
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
  private async send<M extends HttpMethod, P extends string>(
    method: M,
    path: P,
    payload?: Record<string, unknown>,
    attemptsLeft = this.client.config.webSocketRequestAttempts
  ) {
    if (path !== 'migrate') await this.halted;

    return new Promise(
      (
        resolve: (message: ClientResponseMessage<`${M} /ws/${P}`>) => void,
        reject: (error?: ClientErrorMessage) => void
      ) => {
        if (typeof this.client.accessToken === 'undefined' || typeof this.ws === 'undefined') {
          this.logger.error('Cannot send WebSocket messages. Please verify that Client was initialised properly.');

          reject(this.createErrorMessage("Can't send message on WebSocket."));
          return;
        }

        const id = this.getMessageId();

        this.logger.debug(`Registering one-time event handler for message-${id}.`);
        this.events.once(`message-${id}`, (message: ClientResponseMessage<`${M} /ws/${P}`> | ClientErrorMessage) => {
          if (message.responseCode === HttpResponseCode.Ok) {
            resolve(message as ClientResponseMessage<`${M} /ws/${P}`>);
          } else if (attemptsLeft > 0) {
            this.logger.debug(
              `Message-${id} has a non-200 responseCode. Retrying request in ${this.client.config.webSocketRequestRetryDelay} ms.`
            );

            setTimeout(async () => {
              try {
                const result = await this.send(method, path, payload, attemptsLeft - 1);
                resolve(result as ClientResponseMessage<`${M} /ws/${P}`>);
              } catch (error) {
                reject(error as ClientErrorMessage);
              }
            }, this.client.config.webSocketRequestRetryDelay);
          } else {
            this.logger.debug(
              `Message-${id} has a non-200 responseCode. Exhausted maximum number of request attempts.`
            );
            reject(message as ClientErrorMessage);
          }
        });

        const message = JSON.stringify({
          method,
          path,
          authorization: `Bearer ${this.client.accessToken}`,
          id,
          content: JSON.stringify(payload)
        });

        this.logger.debug('Sending message.', message);
        this.ws.send(message, error => typeof error !== 'undefined' && reject(this.createErrorMessage(error.message)));
      }
    ).catch((message: ClientErrorMessage) => {
      this.logger.error('Subscriptions.send() error:', message.content.message);
    });
  }

  /**
   * Subscribes to an account message and registers a callback for it.
   */
  subscribe<T extends ClientEvent>(event: T, key: string, callback: (message: ClientEventMessage<T>) => void) {
    const subscription = `${event}/${key}`;

    if (Object.keys(this.subscriptions).includes(subscription)) {
      this.logger.error(`Already subscribed to ${subscription}.`);
      return;
    }

    this.logger.debug(`Subscribing to ${subscription}.`);
    this.subscriptions = { ...this.subscriptions, [subscription]: callback } as Record<
      string,
      <T>(message: ClientEventMessage<T>) => void
    >;
    this.events.on(subscription, callback);

    return this.send('POST', `subscription/${subscription}`);
  }

  /**
   * Unsubscribes to an account message and removes all callbacks for it.
   */
  unsubscribe<T extends ClientEvent>(event: T, key: string) {
    const subscription = `${event}/${key}`;

    if (!Object.keys(this.subscriptions).includes(subscription)) {
      this.logger.error(`Subscription to ${subscription} does not exist.`);
      return;
    }

    this.logger.debug(`Unsubscribing to ${subscription}.`);
    this.subscriptions = Object.fromEntries(Object.entries(this.subscriptions).filter(([key]) => key !== subscription));
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
