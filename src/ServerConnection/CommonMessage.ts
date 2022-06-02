type MessageType = 'SystemMessage' | 'CommandResult' | 'Subscription';

export type CommonMessage<T extends MessageType> = {
  type: T;
  timeStamp: string;
};
