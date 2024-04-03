type ServerOnlinePlayers = {
  id: number;
  username: string;
};

export type ServerFleet = 'att-release' | 'att-quest';

type JoinType = 'PrivateGroup' | 'Public' | 'OpenGroup' | 'SupporterOnly' | 'WorldInstance' | 'PublicGroup';

export type ServerInfo = {
  id: number;
  name: string;
  online_players: ServerOnlinePlayers[];
  server_status: string;
  final_status: string;
  scene_index: number;
  target: number;
  region: string;
  online_ping?: string; // "2022-06-01T07:53:21.612077Z"
  last_online: string; //  "2022-04-01T09:18:21.5841305Z"
  description: string;
  playability: number;
  version: string;
  group_id: number;
  owner_type: string;
  owner_id: number;
  type: string;
  fleet: ServerFleet;
  up_time: string; // "00:00:00"
  join_type: JoinType;
  player_count: number;
  player_limit: number;
  created_at: string; // "2022-04-01T09:18:21.5841305Z"
  is_online: boolean;
  transport_system: number;
};
