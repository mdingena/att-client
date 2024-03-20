export const enum Verbosity {
  Quiet,
  Error,
  Warning,
  Info,
  Debug
}

const nativeConsole = console;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const noOpFn = (...args: unknown[]): void => void 0; // eslint-disable-line @typescript-eslint/no-unused-vars

interface LoggerArgs {
  console?: Pick<Console, 'error' | 'warn' | 'info' | 'debug'>;
  prefix: string;
  verbosity: Verbosity;
}

export class Logger {
  private logError: Console['error'];
  private logWarn: Console['warn'];
  private logInfo: Console['info'];
  private logDebug: Console['debug'];

  error: Console['error'];
  warn: Console['warn'];
  info: Console['info'];
  debug: Console['debug'];

  constructor({ verbosity, console = nativeConsole, prefix }: LoggerArgs) {
    this.logError = verbosity >= Verbosity.Error ? console.error : noOpFn;
    this.logWarn = verbosity >= Verbosity.Warning ? console.warn : noOpFn;
    this.logInfo = verbosity >= Verbosity.Info ? console.info : noOpFn;
    this.logDebug = verbosity >= Verbosity.Debug ? console.debug : noOpFn;

    const separator = prefix.length === 0 ? '' : ' ';

    this.error = (...args: Parameters<typeof this.logError>) =>
      this.logError(`${prefix}${separator}${args.shift()}`, ...args);
    this.warn = (...args: Parameters<typeof this.logWarn>) =>
      this.logWarn(`${prefix}${separator}${args.shift()}`, ...args);
    this.info = (...args: Parameters<typeof this.logInfo>) =>
      this.logInfo(`${prefix}${separator}${args.shift()}`, ...args);
    this.debug = (...args: Parameters<typeof this.logDebug>) =>
      this.logDebug(`${prefix}${separator}${args.shift()}`, ...args);
  }
}
