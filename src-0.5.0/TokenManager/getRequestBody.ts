import type { ClientConfiguration } from '../ClientConfiguration/ClientConfiguration.js';
import { UserPassword } from './UserPassword.js';

export function getRequestBody(credentials: ClientConfiguration['credentials']): URLSearchParams | string {
  return 'clientId' in credentials
    ? new URLSearchParams({
        grant_type: 'client_credentials',
        scope: credentials.scope.join(' '),
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      })
    : JSON.stringify({
        username: credentials.username,
        password_hash: new UserPassword(credentials.password).hash
      });
}
