import type { ClientEvent } from './ClientEvent';

type ResponseMessage = {
  id: number;
  event: 'response';
  responseCode: number;
};

type DeleteSubscriptionResponseMessage = ResponseMessage & {
  key: `DELETE /ws/subscription/${ClientEvent}`;
  content: '';
};

type GetMigrateResponseMessage = ResponseMessage & {
  key: 'GET /ws/migrate';
  content: {
    token: string;
  };
};

type PostMigrateResponseMessage = ResponseMessage & {
  key: 'POST /ws/migrate';
  content: '';
};

type PostSubscriptionResponseMessage = ResponseMessage & {
  key: `POST /ws/subscription/${ClientEvent}`;
  content: '';
};

type ClientResponseMessageUnion =
  | DeleteSubscriptionResponseMessage
  | GetMigrateResponseMessage
  | PostMigrateResponseMessage
  | PostSubscriptionResponseMessage;

export type ClientResponseMessage<T> = Extract<ClientResponseMessageUnion, { key: T }>;
