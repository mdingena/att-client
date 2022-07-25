import type { GroupServerInfo } from './GroupServerInfo.js';
import type { GroupRoleInfo } from './GroupRoleInfo.js';

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
