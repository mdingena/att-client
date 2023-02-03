import type { ConsoleLike } from './ConsoleLike.js';
import { LogVerbosity } from './LogVerbosity.js';
import { DEFAULTS } from '../constants.js';

function noOpFn(
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  ...args: unknown[] // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  return void 0;
}

export class Log {
  error: Console['error'];
  warn: Console['warn'];
  info: Console['info'];
  debug: Console['debug'];

  constructor(consoleLike: ConsoleLike | undefined, logVerbosity: LogVerbosity | undefined) {
    const configuredConsole = consoleLike ?? DEFAULTS.console;

    if (typeof logVerbosity === 'undefined') {
      configuredConsole.warn(
        "Using Warning log verbosity. You will only see Errors and Warnings. If you want to see more verbose logs, create your client with a higher 'logVerbosity'."
      );
    } else if (logVerbosity >= LogVerbosity.Debug) {
      configuredConsole.warn(
        'You are using Debug log verbosity. This is not recommended for production environments as sensitive information like configured credentials will appear in your logs. Please consider using Info log verbosity or lower for production.'
      );
    }

    const configuredLogVerbosity = logVerbosity ?? DEFAULTS.logVerbosity;

    this.error = configuredLogVerbosity >= LogVerbosity.Error ? configuredConsole.error : noOpFn;
    this.warn = configuredLogVerbosity >= LogVerbosity.Warning ? configuredConsole.warn : noOpFn;
    this.info = configuredLogVerbosity >= LogVerbosity.Info ? configuredConsole.info : noOpFn;
    this.debug = configuredLogVerbosity >= LogVerbosity.Debug ? configuredConsole.debug : noOpFn;
  }
}
