import type { UserCredentials } from '../ClientConfiguration/ClientConfiguration.js';
import type { InternalClientConfiguration } from '../ClientConfiguration/InternalClientConfiguration.js';
import type { TokenManagerConfiguration } from './TokenManager.js';
import { UserPassword } from './UserPassword.js';
import { ApiEndpoint } from '../Api/ApiEndpoint.js';
import { AGENT } from '../constants.js';

type UserTokenRequestConfiguration = TokenManagerConfiguration & {
  credentials: UserCredentials;
};

export class UserTokenRequest extends Request {
  constructor(config: UserTokenRequestConfiguration) {
    const body = JSON.stringify({
      username: config.credentials.username,
      password_hash: new UserPassword(config.credentials.password).hash
    });

    const bodyString = body.toString();

    const headers = new Headers({
      'Content-Length': bodyString.length.toString(),
      'Content-Type': 'application/json',
      'User-Agent': `${AGENT.name} v${AGENT.version}`,
      'x-api-key': config.xApiKey
    });

    const endpoint = `${config.restBaseUrl}${ApiEndpoint.sessions}`;

    super(endpoint, {
      method: 'POST',
      headers,
      body
    });
  }
}
