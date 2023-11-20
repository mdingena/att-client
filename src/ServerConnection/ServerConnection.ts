import type { CommandResultMessage } from './CommandResultMessage.js';
import type { SubscriptionEvent } from './SubscriptionEvent.js';
import type { SubscriptionEventMessage } from './SubscriptionEventMessage.js';
import type { Server } from '../Server/index.js';
import EventEmitter from 'events';
import { TypedEmitter } from 'tiny-typed-emitter';
import { WebSocket } from 'ws';

interface ServerConnectionEvents {
  close: (code?: number, reason?: Buffer) => void;
  error: (error: Error) => void;
  open: () => void;
}

export class ServerConnection extends TypedEmitter<ServerConnectionEvents> {
  server: Server;

  private commandId: number;
  private events: EventEmitter;
  private subscribedEvents: SubscriptionEvent[];
  private ws: WebSocket;

  constructor(server: Server, address: string, port: number, token: string) {
    super();

    this.commandId = 1;
    this.events = new EventEmitter();
    this.server = server;
    this.subscribedEvents = [];

    const that = this;

    function handleError(this: WebSocket, error: Error) {
      that.server.group.client.logger.error(
        `An error occurred on console ${that.server.id} (${that.server.name}).`,
        error.message
      );

      that.emit('error', error);
    }

    function handlePing(this: WebSocket, data: Buffer) {
      that.server.group.client.logger.debug(
        `Received console ${that.server.id} (${that.server.name}) ping.`,
        data.toString()
      );
      this.pong(data);
    }

    function handlePong(this: WebSocket, data: Buffer) {
      that.server.group.client.logger.debug(
        `Received console ${that.server.id} (${that.server.name}) pong.`,
        data.toString()
      );
    }

    function handleClose(this: WebSocket, code: number, reason: Buffer) {
      that.server.group.client.logger.debug(
        `Console ${that.server.id} (${that.server.name}) is closing with code ${code}: ${reason.toString()}.`
      );

      this.removeAllListeners();

      that.emit('close', code, reason);
    }

    function handleMessage(this: WebSocket, data: Buffer, isBinary: boolean) {
      if (isBinary) {
        // This should never happen. There is no Alta documentation about binary data being sent through WebSockets.
        that.server.group.client.logger.error('Puking horses! 🐴🐴🤮'); // https://thepetwiki.com/wiki/do_horses_vomit/
        that.server.group.client.logger.debug(
          `Received binary data on console ${that.server.id} (${that.server.name}):`,
          data.toString()
        );
        return;
      }

      const message = JSON.parse(data.toString());

      const eventName =
        typeof message.commandId === 'undefined'
          ? `${message.type}${typeof message.eventType === 'undefined' ? '' : `/${message.eventType}`}`
          : `command-${message.commandId}`;

      that.server.group.client.logger.debug(
        `Console ${that.server.id} (${that.server.name}) received ${eventName} message.`,
        JSON.stringify(message)
      );

      if (
        that.server.status === 'connecting' &&
        message.type === 'SystemMessage' &&
        message.eventType === 'InfoLog' &&
        (message.data as string).startsWith('Connection Succeeded')
      ) {
        that.emit('open');
        return;
      }

      that.events.emit(eventName, message);
    }

    function handleOpen(this: WebSocket) {
      that.server.group.client.logger.debug(`Console ${that.server.id} (${that.server.name}) opened.`);

      that.server.group.client.logger.debug(
        `Registering console ${that.server.id} (${that.server.name}) event handlers.`
      );
      this.on('ping', handlePing);
      this.on('pong', handlePong);
      this.on('message', handleMessage);

      this.send(token, error => {
        if (typeof error !== 'undefined') {
          that.server.group.client.logger.error(
            `Couldn't authenticate console ${that.server.id} (${that.server.name}) connection.`,
            error.message
          );
          return;
        }

        that.server.group.client.logger.debug(
          `Authenticated console connection on server ${that.server.id} (${that.server.name}).`
        );
      });
    }

    this.ws = new WebSocket(`ws://${address}:${port}`);
    this.ws.on('error', handleError);
    this.ws.once('close', handleClose);
    this.ws.once('open', handleOpen);
  }

  /**
   * Gets a unique console message ID.
   */
  private getCommandId() {
    return this.commandId++;
  }

  /**
   * Sends a console request and returns a Promise of the response.
   * To subscribe or unsubscribe from server events, please use
   * `ServerConnection.subscribe()` or `ServerConnection.unsubscribe()`.
   * @example
   * client.on('connect', async connection => {
   *   const commandResult = await connection.send('player message * "Bot connected to this server" 5');
   * });
   */
  send<T>(command: string) {
    if (/^(websocket )?(un)?subscribe/i.test(command)) {
      throw new Error(`Do not use send() to (un)subscribe to events. Please use subscribe() or unsubscribe() instead.`);
    }

    return this.command<T>(command);
  }

  /**
   * Passes the command string to the server via console connection and registers
   * an event handler for the asynchronous response message.
   */
  private command<T>(command: string) {
    return new Promise(
      (
        resolve: (message: CommandResultMessage<T>) => void,
        reject: (error?: Error | CommandResultMessage<T>) => void
      ) => {
        const id = this.getCommandId();

        this.events.once(`command-${id}`, (message: CommandResultMessage<T>) => resolve(message));

        const message = JSON.stringify({ id, content: command });

        this.server.group.client.logger.debug(
          `Sending command-${id} to ${this.server.id} (${this.server.name}).`,
          message
        );
        this.ws.send(message, error => error && reject(error));
      }
    );
  }

  /**
   * Subscribes to a server event and registers a callback for it.
   * @example
   * client.on('connect', async connection => {
   *   const subscribeResult = await connection.subscribe('PlayerMovedChunk', message => {
   *     const { player, newChunk } = message.data;
   *     connection.send(`player message ${player.id} "${newChunk}" 3`);
   *   });
   * });
   */
  subscribe<T extends SubscriptionEvent>(event: T, callback: (message: SubscriptionEventMessage<T>) => void) {
    if (this.subscribedEvents.includes(event)) {
      throw new Error(`Already subscribed to ${event} on server ${this.server.id} (${this.server.name}).`);
    }

    this.server.group.client.logger.info(`Subscribing to ${event} on server ${this.server.id} (${this.server.name}).`);
    this.subscribedEvents = [...this.subscribedEvents, event];
    this.events.on(`Subscription/${event}`, callback);

    return this.command(`websocket subscribe ${event}`);
  }

  /**
   * Unsubscribes to a server event and removes all callbacks for it.
   * @example
   * client.on('connect', async connection => {
   *   const subscribeResult = await connection.subscribe('PlayerMovedChunk', callback);
   *   // ...
   *   const unsubscribeResult = await connection.unsubscribe('PlayerMovedChunk');
   * });
   */
  unsubscribe<T extends SubscriptionEvent>(event: T) {
    if (!this.subscribedEvents.includes(event)) {
      throw new Error(`Subscription to ${event} does not exist on server ${this.server.id} (${this.server.name}).`);
    }

    this.server.group.client.logger.info(
      `Unsubscribing to ${event} on server ${this.server.id} (${this.server.name}).`
    );
    this.subscribedEvents = this.subscribedEvents.filter(existing => existing !== event);
    this.events.removeAllListeners(`Subscription/${event}`);

    return this.command(`websocket unsubscribe ${event}`);
  }

  /**
   * Disposes this server connection. Tears down all event listeners and closes
   * the WebSocket connection.
   */
  dispose() {
    this.ws.close(1000, 'Disposing console connection.');
    this.events.removeAllListeners();
  }

  /**
   * Alias for ServerConnection.server.disconnect().
   */
  disconnect() {
    this.server.disconnect();
  }
}
