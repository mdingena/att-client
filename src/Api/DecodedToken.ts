import type { Scope } from '../Client/Config';

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
