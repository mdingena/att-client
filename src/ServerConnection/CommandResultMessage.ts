import type { CommonMessage } from './CommonMessage';

type CommandParameter = {
  Type: string;
  HasDefault: boolean;
  Default: null | unknown;
  Attributes: unknown[];
  Name: string;
  FullName: string;
};

export type CommandResultMessage<T> = CommonMessage<'CommandResult'> & {
  commandId: number;
  data: {
    Result: T;
    ResultString: string;
    Command: {
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
  };
};
