import type { CommonMessage } from './CommonMessage.js';

type CommandParameter = {
  Type: string;
  HasDefault: boolean;
  Default: null | unknown;
  Attributes: unknown[];
  Name: string;
  FullName: string;
};

type CommandResult<T> = {
  Result?: T;
  ResultString?: string;
  Command?: {
    Parameters: CommandParameter[];
    IsProgressive: boolean;
    ReturnType: string;
    Priority: number;
    Aliases: string[];
    FullName: string;
    Requirements: unknown[];
    Attributes: unknown[];
    Name: string;
    Description: string;
  };
  Exception?: {
    ClassName: string;
    Message: string;
    Data: null | unknown;
    InnerException: null | unknown;
    HelpURL: null | unknown;
    StackTraceString: null | unknown;
    RemoteStackTraceString: null | unknown;
    RemoteStackIndex: number;
    ExceptionMethod: null | unknown;
    HResult: number;
    Source: null | unknown;
  };
};

export type CommandResultMessage<T> = CommonMessage<'CommandResult'> & {
  commandId: number;
  data: CommandResult<T>;
};
