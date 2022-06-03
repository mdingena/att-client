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

export class Logger {
  error: Console['error'];
  warn: Console['warn'];
  info: Console['info'];
  debug: Console['debug'];

  constructor(verbosity: Verbosity, console: Pick<Console, 'error' | 'warn' | 'info' | 'debug'> = nativeConsole) {
    this.error = verbosity >= Verbosity.Error ? console.error : noOpFn;
    this.warn = verbosity >= Verbosity.Warning ? console.warn : noOpFn;
    this.info = verbosity >= Verbosity.Info ? console.info : noOpFn;
    this.debug = verbosity >= Verbosity.Debug ? console.debug : noOpFn;
  }
}
