import type { CommonMessage } from './CommonMessage';
import type { SubscriptionEvent } from './SubscriptionEvent';

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

export type SubscriptionEventMessage<T extends SubscriptionEvent> = Extract<
  SubscriptionEventMessageUnion,
  { eventType: T }
>;
