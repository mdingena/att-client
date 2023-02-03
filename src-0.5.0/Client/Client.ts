import type { InternalClientConfiguration } from '../ClientConfiguration/InternalClientConfiguration.js';
import type { ClientConfiguration } from '../ClientConfiguration/ClientConfiguration.js';
import { TypedEmitter } from 'tiny-typed-emitter';
import { getInternalClientConfiguration } from '../ClientConfiguration/InternalClientConfiguration.js';
import { validateClientConfiguration } from './validateClientConfiguration.js';
import { GroupManager } from '../GroupManager/GroupManager.js';
import { Log } from '../Log/Log.js';
import { TokenManager } from '../TokenManager/TokenManager.js';

interface ClientEvents {
  connect: () => void;
  ready: () => void;
}

export class Client extends TypedEmitter<ClientEvents> {
  private configuration: InternalClientConfiguration;
  private groupManager: GroupManager;
  private log: Log;
  private tokenManager: TokenManager;

  constructor(config: ClientConfiguration) {
    super();

    this.log = new Log(config.console, config.logVerbosity);

    validateClientConfiguration(config, this.log);

    this.configuration = getInternalClientConfiguration(config);
    this.groupManager = new GroupManager();
    this.tokenManager = new TokenManager(this.configuration, this.log);
  }
}
