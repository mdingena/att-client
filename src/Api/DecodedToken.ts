import type { Scope } from '../Client/Config.js';

type CommonToken = {
  nbf: number;
  exp: number;
  iss: string;
  aud: string[];
};

type BotToken = CommonToken & {
  client_id: string;
  client_sub: string;
  client_username: string;
  client_bot: 'true' | 'false';
  scope: Scope;
};

type UserToken = CommonToken & {
  UserId: string;
  Username: string;
  role: string;
  is_verified: string;
  Policy: string[];
};

export type DecodedToken = BotToken | UserToken;
