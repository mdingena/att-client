import type { CommonMessage } from './CommonMessage';

export type SubscriptionEventType =
  | 'DebugLog'
  | 'ErrorLog'
  | 'FatalLog'
  | 'InfoLog'
  | 'ObjectKilled'
  | 'PlayerJoined'
  | 'PlayerKilled'
  | 'PlayerLeft'
  | 'PlayerMovedChunk'
  | 'PlayerStateChanged'
  | 'PopulationModified'
  | 'ProfilingData'
  | 'TraceLog'
  | 'TradeDeckUsed'
  | 'TrialFinished'
  | 'TrialStarted'
  | 'WarnLog';

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

type SubscriptionEventMessageUnion = PlayerMovedChunkSubscriptionEventMessage;

export type SubscriptionEventMessage<T extends SubscriptionEventType> = Extract<
  SubscriptionEventMessageUnion,
  { eventType: T }
>;
