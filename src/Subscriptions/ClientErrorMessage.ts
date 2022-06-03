export type ClientErrorMessage = {
  id: number;
  event: 'response';
  key: string;
  responseCode: number;
  content: {
    message: string;
    error_code: string;
  };
};
