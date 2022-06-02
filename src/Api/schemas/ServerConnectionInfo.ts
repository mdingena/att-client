export type ServerConnectionInfo = {
  server_id: number;
  allowed: boolean;
  was_rejection: boolean;
  cold_start: boolean;
  fail_reason: string;
  connection: {
    server_id: number;
    address: string;
    local_address: string;
    pod_name: string;
    game_port: number;
    console_port: number;
    logging_port: number;
    websocket_port: number;
    webserver_port: number;
  };
  token: string;
};
