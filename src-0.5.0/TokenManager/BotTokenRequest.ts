import type { TokenManagerConfiguration } from './TokenManager.js';
import type { BotCredentials } from '../ClientConfiguration/ClientConfiguration.js';
import { AGENT } from '../constants.js';

type BotTokenRequestConfiguration = TokenManagerConfiguration & {
  credentials: BotCredentials;
};

export class BotTokenRequest extends Request {
  constructor(config: BotTokenRequestConfiguration) {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: config.credentials.scope.join(' '),
      client_id: config.credentials.clientId,
      client_secret: config.credentials.clientSecret
    });

    const bodyString = body.toString();

    const headers = new Headers({
      'Content-Length': bodyString.length.toString(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': `${AGENT.name} v${AGENT.version}`
    });

    const endpoint = config.tokenUrl;

    super(endpoint, {
      method: 'POST',
      headers,
      body
    });
  }
}
