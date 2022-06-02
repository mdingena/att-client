type AllowedDataTypes = string | number | boolean | { [key: string]: AllowedDataTypes } | AllowedDataTypes[];

export type ApiRequest = Record<string, AllowedDataTypes>;
