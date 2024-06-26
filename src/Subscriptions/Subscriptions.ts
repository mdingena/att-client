import type { Client } from '../Client/index.js';
import type { ClientEvent } from './ClientEvent.js';
import type { ClientEventMessage } from './ClientEventMessage.js';
import type { ClientErrorMessage } from './ClientErrorMessage.js';
import type { ClientResponseMessage } from './ClientResponseMessage.js';
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { HttpMethod, HttpResponseCode } from '../Api/index.js';
import { Workers } from '../Workers/index.js';

type SubscribeResult = void | ClientResponseMessage<`POST /ws/subscription/${ClientEvent}`>;

export class Subscriptions {
  client: Client;
  halted: Promise<void>;

  private events: EventEmitter;
  private instanceId: number;
  private messageId: number;
  private migrationDelay?: NodeJS.Timeout;
  private migrationId: number;
  private pingInterval?: NodeJS.Timer;
  private resolveHalted?: (value: void | PromiseLike<void>) => void;
  private subscriptions: Record<string, (message: ClientEventMessage<ClientEvent>) => void>;
  private ws?: WebSocket;

  constructor(client: Client, instanceId: number) {
    this.events = new EventEmitter();
    this.instanceId = instanceId;
    this.client = client;
    this.halted = Promise.resolve();
    this.messageId = 1;
    this.migrationId = 1;
    this.subscriptions = {};
  }

  /**
   * Initialises a WebSocket connection with the Alta server.
   */
  async init(): Promise<void> {
    if (typeof this.resolveHalted === 'undefined') {
      this.halted = new Promise(resolve => {
        this.resolveHalted = resolve;
      });
    }

    if (typeof this.client.accessToken === 'undefined') {
      this.client.logger.error(
        `[SUBSCRIPTIONS-${this.instanceId}] Can't initialise subscriptions without an access token. Ordering client to refresh tokens.`
      );
      await this.client.refreshTokens();
      await this.init();
      return;
    }

    this.ws = await this.createWebSocket(this.client.accessToken, this.migrationId);

    this.clearHalted();
  }

  /**
   * Creates a new WebSocket instance.
   */
  private async createWebSocket(accessToken: string, migrationId: number): Promise<WebSocket> {
    try {
      return await new Promise<WebSocket>((resolve, reject) => {
        const that = this;

        function handleError(this: WebSocket, error: Error) {
          that.client.logger.error(
            `[SUBSCRIPTIONS-${that.instanceId}] An error occurred on the WebSocket.`,
            error.message
          );

          /**
           * If errors happen before the WebSocket connection is opened, it's likely
           * that the WebSocket won't open anymore. In this case we want to reject
           * so that we can trigger a recovery.
           *
           * In other cases, errors will happen during a connection. If that results
           * in the WebSocket closing, we can handle this in the onClose handler,
           * because supposedly not all errors result in a disconnect.
           *
           * See: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
           */
          if (this.readyState !== 1) {
            this.removeAllListeners();
            clearInterval(that.pingInterval);

            reject(error);
          }
        }

        function handlePing(this: WebSocket, data: Buffer) {
          that.client.logger.debug(`[SUBSCRIPTIONS-${that.instanceId}] Received WebSocket ping.`, data.toString());
          this.pong(data);
        }

        function handlePong(this: WebSocket, data: Buffer) {
          that.client.logger.debug(`[SUBSCRIPTIONS-${that.instanceId}] Received WebSocket pong.`, data.toString());
        }

        async function handleClose(this: WebSocket, code: number, reason: Buffer) {
          that.client.logger.debug(
            `[SUBSCRIPTIONS-${that.instanceId}] WebSocket is closing with code ${code}: ${reason.toString()}`
          );

          this.removeAllListeners();
          clearInterval(that.pingInterval);

          /* Migrations close WebSocket with code 3000 or 3001. */
          if (code !== 3000 && code !== 3001) {
            that.client.logger.error(
              `[SUBSCRIPTIONS-${that.instanceId}] WebSocket closed abnormally with code ${code}: ${reason}`
            );
            that.client.logger.info(`[SUBSCRIPTIONS-${that.instanceId}] Restarting WebSocket and subscriptions.`);

            await that.recoverWebSocket();
          }
        }

        function handleMessage(this: WebSocket, data: Buffer, isBinary: boolean) {
          if (isBinary) {
            // This should never happen. There is no Alta documentation about binary data being sent through WebSockets.
            that.client.logger.error(`[SUBSCRIPTIONS-${that.instanceId}] Puking horses! 🐴🐴🤮`); // https://thepetwiki.com/wiki/do_horses_vomit/
            that.client.logger.debug(
              `[SUBSCRIPTIONS-${that.instanceId}] Received binary data on WebSocket.`,
              data.toString()
            );
            return;
          }

          const message = JSON.parse(data.toString());

          if (typeof message.content === 'undefined') {
            that.client.logger.error(
              `[SUBSCRIPTIONS-${that.instanceId}] Received a message with ID ${message.id} but no content.`,
              JSON.stringify(message)
            );
            return;
          }

          /* Handle messages during migration. */
          if (
            migrationId === that.migrationId &&
            typeof that.resolveHalted !== 'undefined' &&
            message.key === 'POST /ws/migrate'
          ) {
            that.events.emit('migrate', message);
            return;
          }

          that.client.logger.debug(
            `[SUBSCRIPTIONS-${that.instanceId}] Received ${message.event} message with ID ${message.id}.`,
            JSON.stringify(message)
          );

          const eventName = message.id === 0 ? `${message.event}/${message.key}` : `message-${message.id}`;
          that.events.emit(eventName, {
            ...message,
            content: message.content.length > 0 ? JSON.parse(message.content) : message.content
          });
        }

        function handleOpen(this: WebSocket) {
          that.client.logger.debug(`[SUBSCRIPTIONS-${that.instanceId}] WebSocket opened.`);

          this.on('ping', handlePing);
          this.on('pong', handlePong);
          this.on('message', handleMessage);

          clearInterval(that.pingInterval);
          that.pingInterval = setInterval(() => {
            that.ping(this);
          }, that.client.config.webSocketPingInterval);

          resolve(ws);
        }

        this.client.logger.debug(`[SUBSCRIPTIONS-${that.instanceId}] Creating new WebSocket.`);

        const headers = {
          'Content-Type': 'application/json',
          'x-api-key': this.client.config.xApiKey,
          'User-Agent': this.client.name,
          'Authorization': `Bearer ${accessToken}`
        };
        this.client.logger.debug(
          `[SUBSCRIPTIONS-${that.instanceId}] Configured WebSocket headers.`,
          JSON.stringify(headers)
        );

        const ws = new WebSocket(this.client.config.webSocketUrl, { headers });

        ws.on('error', handleError);
        ws.once('close', handleClose);
        ws.once('open', handleOpen);

        this.client.logger.debug(`[SUBSCRIPTIONS-${that.instanceId}] Created new WebSocket.`);

        clearTimeout(this.migrationDelay);
        this.migrationDelay = setTimeout(this.migrate.bind(this), this.client.config.webSocketMigrationInterval);
      });
    } catch (error) {
      this.client.logger.error(
        `[SUBSCRIPTIONS-${this.instanceId}] Something went wrong opening WebSocket to Alta. Retrying in ${
          this.client.config.webSocketRecoveryRetryDelay
        } ms. Error was: ${(error as Error).message}`
      );

      await new Promise(resolve => setTimeout(resolve, this.client.config.webSocketRecoveryRetryDelay));
      return await this.createWebSocket(accessToken, migrationId);
    }
  }

  /**
   * Sends a ping on the WebSocket.
   */
  private ping(ws: WebSocket) {
    this.client.logger.debug(`[SUBSCRIPTIONS-${this.instanceId}] Pinging WebSocket.`);
    ws.ping(this.client.name);
  }

  /**
   * Migrates the WebSocket. Instructs the Alta server to migrate all existing subscriptions to a new connection.
   */
  async migrate(migrationToken?: string) {
    await this.halted;

    if (typeof this.ws === 'undefined') {
      this.client.logger.warn(
        `[SUBSCRIPTIONS-${this.instanceId}] There is no WebSocket to migrate. Creating new WebSocket.`
      );
      await this.init();
      return;
    }

    if (typeof this.client.accessToken === 'undefined') {
      this.client.logger.warn(
        `[SUBSCRIPTIONS-${this.instanceId}] Can't migrate WebSocket without an access token. Ordering client to refresh tokens.`
      );
      await this.client.refreshTokens();
      await this.migrate();
      return;
    }

    this.client.logger.info(`[SUBSCRIPTIONS-${this.instanceId}] Beginning WebSocket migration.`);

    clearTimeout(this.migrationDelay);

    let token: string;

    if (typeof migrationToken === 'undefined') {
      this.client.logger.debug(`[SUBSCRIPTIONS-${this.instanceId}] Retrieving migration token.`);
      const requestMigrateResponse = await this.send('GET', 'migrate');

      if (typeof requestMigrateResponse === 'undefined') {
        await this.retryMigration();
        return;
      }

      token = requestMigrateResponse.content.token;
      this.client.logger.debug(`[SUBSCRIPTIONS-${this.instanceId}] Received migration token.`, token);
    } else {
      token = migrationToken;
      this.client.logger.debug(`[SUBSCRIPTIONS-${this.instanceId}] Reusing migration token.`, token);
    }

    /* Track migration state. Will halt all outbound messages. */
    this.halted = new Promise(resolve => {
      this.resolveHalted = resolve;
    });

    /* Create a new WebSocket instance. */
    this.migrationId = this.getMigrationId();
    const oldWs = this.ws;
    delete this.ws;
    this.ws = await this.createWebSocket(this.client.accessToken, this.migrationId);

    /* Send the migration token over new WebSocket. */
    try {
      await this.sendMigrationToken(token);
    } catch (error) {
      clearInterval(this.pingInterval);
      this.ws.removeAllListeners();
      this.ws.close(3001, 'Migration aborted.');
      delete this.ws;
      this.ws = oldWs;
      /**
       * 2022-06-17 v0.2.21
       * This used to be `this.retryMigration(token)` but migration still fails server-side and cannot be recovered without also resubscribing
       * all subscriptions. This is what `this.recoverWebSocket()` handles.
       * Additionally, we removed the `this.clearHalted()` call so that queued outbound messages remain blocked until recovery has succeeded.
       */
      await this.recoverWebSocket();
      return;
    }

    /* Migration completed. Resume outbound messages. */
    this.clearHalted();

    /* Gracefully discard old WebSocket instance. */
    this.client.logger.info(
      `[SUBSCRIPTIONS-${this.instanceId}] Successfully migrated WebSocket. Gracefully shutting down old WebSocket in ${this.client.config.webSocketMigrationHandoverPeriod} ms.`
    );

    await new Promise(resolve => setTimeout(resolve, this.client.config.webSocketMigrationHandoverPeriod));

    oldWs.close(3000, 'Migration completed.');
    oldWs.removeAllListeners();
    this.client.logger.info(`[SUBSCRIPTIONS-${this.instanceId}] Closed old WebSocket.`);
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
          this.client.logger.error(
            `[SUBSCRIPTIONS-${this.instanceId}] Something went wrong posting the WebSocket migration token. Received message:`,
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
    this.client.logger.error(
      `[SUBSCRIPTIONS-${this.instanceId}] Client failed to migrate WebSocket. Retrying in ${this.client.config.webSocketMigrationRetryDelay} ms.`
    );

    await new Promise(resolve => setTimeout(resolve, this.client.config.webSocketMigrationRetryDelay));

    await this.migrate(migrationToken);
  }

  /**
   * Clears any pending halted Promise, unblocking queued messages waiting for a WebSocket instance.
   */
  private clearHalted() {
    if (typeof this.resolveHalted !== 'undefined') {
      this.client.logger.debug(`[SUBSCRIPTIONS-${this.instanceId}] Resolving halted Promise.`);
      this.resolveHalted();
      delete this.resolveHalted;
    }
  }

  /**
   * Recovers from an abnormally closed WebSocket connection.
   * This class should always maintain an active WebSocket. When the WebSocket is closed abnormally, this method
   * creates a new WebSocket and restores all subscriptions.
   */
  private async recoverWebSocket() {
    if (typeof this.client.accessToken === 'undefined') {
      this.client.logger.warn(
        `[SUBSCRIPTIONS-${this.instanceId}] Can't migrate WebSocket without an access token. Ordering client to refresh tokens.`
      );
      await this.client.refreshTokens();
      await this.recoverWebSocket();
      return;
    }

    this.client.logger.info(`[SUBSCRIPTIONS-${this.instanceId}] Recovering WebSocket connection.`);

    /* Track recovery state. Will halt all outbound messages. */
    if (typeof this.resolveHalted === 'undefined') {
      this.halted = new Promise(resolve => {
        this.resolveHalted = resolve;
      });
    }

    /* Create new WebSocket */
    clearInterval(this.pingInterval);
    this.migrationId = this.getMigrationId();
    this.ws?.removeAllListeners();
    delete this.ws;
    this.ws = await this.createWebSocket(this.client.accessToken, this.migrationId);

    /* Unblock all backed-up messages. */
    this.clearHalted();

    /* Save all tracked subscriptions and reset tracker. */
    const subscriptions = { ...this.subscriptions };
    this.subscriptions = {};

    /* Resubscribe to all saved subscriptions. */
    const workers = new Workers(this.client.config.maxWorkerConcurrency);
    const tasks = Object.entries(subscriptions).map(([entry, callback]) => () => {
      const [subscription, key] = entry.split('/') as [ClientEvent, string];

      if (typeof subscription !== 'string' || typeof key !== 'string') return Promise.resolve();

      this.events.removeAllListeners(entry);
      return (
        this.subscribe(subscription, key, callback) ??
        Promise.reject(
          new Error(
            `WebSocket recovery failed! Resubscribing to ${entry} was unsuccessful. Retrying recovery in ${this.client.config.webSocketRecoveryRetryDelay} ms.`
          )
        )
      );
    });

    try {
      await Promise.race<SubscribeResult[]>([
        await workers.do(tasks),
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
    } catch (error) {
      /* WebSocket recovery has failed. */
      this.halted = new Promise(resolve => {
        this.resolveHalted = resolve;
      });

      this.client.logger.error(`[SUBSCRIPTIONS-${this.instanceId}] ${(error as Error).message}`);

      await new Promise(resolve => setTimeout(resolve, this.client.config.webSocketRecoveryRetryDelay));

      /* Restore original tracked subscriptions before retrying WebSocket recovery. */
      this.subscriptions = subscriptions;

      await this.recoverWebSocket();
      return;
    }

    this.client.logger.info(`[SUBSCRIPTIONS-${this.instanceId}] Successfully recovered WebSocket connection.`);
  }

  /**
   * Gets a unique WebSocket message ID.
   */
  private getMessageId() {
    return this.messageId++;
  }

  /**
   * Gets a unique WebSocket migration ID.
   */
  private getMigrationId() {
    return this.migrationId++;
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

    return await new Promise(
      (
        resolve: (message: ClientResponseMessage<`${M} /ws/${P}`>) => void,
        reject: (error?: ClientErrorMessage) => void
      ) => {
        if (typeof this.client.accessToken === 'undefined' || typeof this.ws === 'undefined') {
          this.client.logger.error(
            `[SUBSCRIPTIONS-${this.instanceId}] Cannot send WebSocket messages. Please verify that Client was initialised properly.`
          );

          reject(this.createErrorMessage("Can't send message on WebSocket."));
          return;
        }

        const id = this.getMessageId();

        this.events.once(`message-${id}`, (message: ClientResponseMessage<`${M} /ws/${P}`> | ClientErrorMessage) => {
          if (message.responseCode === HttpResponseCode.Ok) {
            resolve(message as ClientResponseMessage<`${M} /ws/${P}`>);
          } else if (attemptsLeft > 0) {
            this.client.logger.debug(
              `[SUBSCRIPTIONS-${this.instanceId}] Message-${id} has a non-200 responseCode. Retrying request in ${this.client.config.webSocketRequestRetryDelay} ms.`
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
            this.client.logger.debug(
              `[SUBSCRIPTIONS-${this.instanceId}] Message-${id} has a non-200 responseCode. Exhausted maximum number of request attempts.`
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

        this.client.logger.debug(
          `[SUBSCRIPTIONS-${this.instanceId}] Sending message-${id}.`,
          JSON.stringify({ id, method, path, content: JSON.stringify(payload) })
        );

        this.ws.send(message, error => error && reject(this.createErrorMessage(error.message ?? 'Unknown error.')));
      }
    ).catch((message: ClientErrorMessage) => {
      this.client.logger.error(
        `[SUBSCRIPTIONS-${this.instanceId}] Subscriptions.send() error:`,
        message.content.message
      );
    });
  }

  /**
   * Subscribes to an account message and registers a callback for it.
   */
  subscribe<T extends ClientEvent>(event: T, key: string, callback: (message: ClientEventMessage<T>) => void) {
    const subscription = `${event}/${key}`;

    if (Object.keys(this.subscriptions).includes(subscription)) {
      this.client.logger.error(`[SUBSCRIPTIONS-${this.instanceId}] Already subscribed to ${subscription}.`);
      return;
    }

    this.client.logger.debug(`[SUBSCRIPTIONS-${this.instanceId}] Subscribing to ${subscription}.`);
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
      this.client.logger.error(`[SUBSCRIPTIONS-${this.instanceId}] Subscription to ${subscription} does not exist.`);
      return;
    }

    this.client.logger.debug(`[SUBSCRIPTIONS-${this.instanceId}] Unsubscribing to ${subscription}.`);
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

  getSize(): number {
    return Object.keys(this.subscriptions).length;
  }
}
