import type { CommonMessage } from './CommonMessage.js';
import type { SubscriptionEvent } from './SubscriptionEvent.js';

type DebugLogSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'DebugLog';
  data: unknown;
};

type ErrorLogSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'ErrorLog';
  data: unknown;
};

type FatalLogSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'FatalLog';
  data: unknown;
};

type InfoLogSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'InfoLog';
  data: unknown;
};

type InventoryChangedSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'InventoryChanged';
  data: {
    User: {
      id: number;
      username: string;
    };
    ItemName: string;
    Quantity: number;
    ItemHash?: string;
    Material?: string;
    SaveString: string;
    ChangeType: 'Pickup' | 'Drop' | 'Dock' | 'UnDock';
    InventoryType: 'World' | 'Player';
    DestinationUser?: {
      id: number;
      username: string;
    };
  };
};

type ObjectKilledSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'ObjectKilled';
  data: {
    identifier: number;
    prefab: number;
    name: string;
    source: 'Unknown' | 'Impact' | 'FallDamage';
    usedTool?: string;
    toolWielder?: string;
    killerPlayer?: {
      id: number;
      username: string;
    };
  };
};

type PlayerJoinedSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'PlayerJoined';
  data: {
    user: {
      id: number;
      username: string;
    };
    mode: string;
    position: [number, number, number];
  };
};

type PlayerKilledSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'PlayerKilled';
  data: {
    killedPlayer: {
      id: number;
      username: string;
    };
    source: 'Unknown' | 'Impact' | 'FallDamage';
    usedTool?: string;
    toolWielder?: string;
    killerPlayer?: {
      id: number;
      username: string;
    };
  };
};

type PlayerLeftSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'PlayerLeft';
  data: {
    user: {
      id: number;
      username: string;
    };
    mode: string;
    position: [number, number, number];
  };
};

type PlayerMovedChunkSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'PlayerMovedChunk';
  data: {
    player: {
      id: number;
      username: string;
    };
    oldChunk: string;
    newChunk: string;
  };
};

type PlayerStateChangedSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'PlayerStateChanged';
  data: {
    user: {
      id: number;
      username: string;
    };
    state: 'Playing' | 'Combat' | 'Dead';
    isEnter: boolean;
  };
};

type PopulationModifiedSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'PopulationModified';
  data: {
    populationName: string;
    chunkIdentifier: string;
    currentPopulation: number;
    maxPopulation: number;
    action: 'Spawned' | 'Lost';
  };
};

type ProfilingDataSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'ProfilingData';
  data: unknown;
};

type TraceLogSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'TraceLog';
  data: {
    message: string;
    timeStamp: string;
    logger: string;
  };
};

type TradeDeckUsedSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'TradeDeckUsed';
  data: {
    itemName: string;
    itemHash: number;
    price: number;
    quantity: number;
    buyer: number;
    seller: number;
  };
};

type TrialFinishedSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'TrialFinished';
  data: unknown;
};

type TrialStartedSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'TrialStarted';
  data: unknown;
};

type WarnLogSubscriptionEventMessage = CommonMessage<'Subscription'> & {
  eventType: 'WarnLog';
  data: unknown;
};

type SubscriptionEventMessageUnion =
  | DebugLogSubscriptionEventMessage
  | ErrorLogSubscriptionEventMessage
  | FatalLogSubscriptionEventMessage
  | InfoLogSubscriptionEventMessage
  | InventoryChangedSubscriptionEventMessage
  | ObjectKilledSubscriptionEventMessage
  | PlayerJoinedSubscriptionEventMessage
  | PlayerKilledSubscriptionEventMessage
  | PlayerLeftSubscriptionEventMessage
  | PlayerMovedChunkSubscriptionEventMessage
  | PlayerStateChangedSubscriptionEventMessage
  | PopulationModifiedSubscriptionEventMessage
  | ProfilingDataSubscriptionEventMessage
  | TraceLogSubscriptionEventMessage
  | TradeDeckUsedSubscriptionEventMessage
  | TrialFinishedSubscriptionEventMessage
  | TrialStartedSubscriptionEventMessage
  | WarnLogSubscriptionEventMessage;

export type SubscriptionEventMessage<T extends SubscriptionEvent> = Extract<
  SubscriptionEventMessageUnion,
  { eventType: T }
>;
