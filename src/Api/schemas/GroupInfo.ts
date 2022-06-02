import type { GroupServerInfo } from './GroupServerInfo';
import type { GroupRoleInfo } from './GroupRoleInfo';

export type GroupInfo = {
  id: number;
  name?: string;
  description?: string;
  member_count: number;
  created_at: string;
  type: string;
  tags?: string[];
  servers?: GroupServerInfo[];
  allowed_server_count?: number;
  roles?: GroupRoleInfo[];
};
