import type { Scope } from '../Config';

export type DecodedToken = {
  nbf: number;
  exp: number;
  iss: string;
  aud: string[];
  client_id: string;
  client_sub: string;
  client_username: string;
  client_bot: 'true' | 'false';
  scope: Scope;
};
