import type { ClientEvent } from '../Subscriptions/ClientEvent.js';
import type { Client } from '../Client/Client.js';
import type { ClientEventMessage } from '../Subscriptions/ClientEventMessage.js';
import { Subscriptions } from '../Subscriptions/Subscriptions.js';

type Instances = Map<number, Subscriptions>;
type InstanceIdMap = Map<string, number>;

export class SubscriptionsManager {
  public client: Client;
  public instances: Instances;
  private nextInstanceId: number;
  private subscriptionsMap: InstanceIdMap;

  constructor(client: Client) {
    this.client = client;
    this.instances = new Map();
    this.nextInstanceId = 0;
    this.subscriptionsMap = new Map();
  }

  /**
   * Subscribes to an account message and registers a callback for it.
   */
  public async subscribe<T extends ClientEvent>(
    event: T,
    key: string,
    callback: (message: ClientEventMessage<T>) => void
  ) {
    const subscription = `${event}/${key}`;

    if (this.subscriptionsMap.has(subscription)) {
      this.client.logger.error(`[SUBSCRIPTIONS-MANAGER] Already subscribed to ${subscription}.`);
      return;
    }

    const [instanceId, subscriptions] = await this.getInstanceWithCapacity();
    const subscribeResult = await subscriptions.subscribe(event, key, callback);

    this.subscriptionsMap.set(subscription, instanceId);

    return subscribeResult;
  }

  /**
   * Unsubscribes to an account message and removes all callbacks for it.
   */
  public async unsubscribe<T extends ClientEvent>(event: T, key: string) {
    const subscription = `${event}/${key}`;
    const instanceId = this.subscriptionsMap.get(subscription);

    if (typeof instanceId === 'undefined') {
      this.client.logger.error(`[SUBSCRIPTIONS-MANAGER] Subscription to ${subscription} does not exist.`);
      return;
    }

    const subscriptions = this.instances.get(instanceId);

    if (typeof subscriptions === 'undefined') {
      this.client.logger.error(
        `[SUBSCRIPTIONS-MANAGER] Couldn't retrieve managed subscriptions instance matching subscription to ${subscription}.`
      );
      return;
    }

    const unsubscribeResult = await subscriptions.unsubscribe(event, key);

    this.subscriptionsMap.delete(subscription);

    if (subscriptions.getSize() === 0) {
      this.client.logger.debug(`[SUBSCRIPTIONS-MANAGER] Subscriptions instance ${instanceId} is empty. Cleaning up.`);
      this.instances.delete(instanceId);
    }

    return unsubscribeResult;
  }

  /**
   * Gets a unique managed instance ID.
   */
  private getInstanceId() {
    return this.nextInstanceId++;
  }

  /**
   * Finds an existing Subscriptions instance with remaining capacity or returns a new
   * instance.
   */
  private async getInstanceWithCapacity(): Promise<Readonly<[number, Subscriptions]>> {
    const maxSubscriptions = this.client.config.maxSubscriptionsPerWebSocket;

    for (const [instanceId, subscriptions] of this.instances) {
      if (subscriptions.getSize() < maxSubscriptions) return [instanceId, subscriptions] as const;
    }

    this.client.logger.debug(`[SUBSCRIPTIONS-MANAGER] Increasing the Subscriptions instance pool.`);

    const instanceId = this.getInstanceId();
    const subscriptions = new Subscriptions(this.client, instanceId);
    this.instances.set(instanceId, subscriptions);

    await subscriptions.init();

    this.client.logger.debug(`[SUBSCRIPTIONS-MANAGER] Created new Subscriptions instance with ID ${instanceId}.`);

    return [instanceId, subscriptions] as const;
  }
}
