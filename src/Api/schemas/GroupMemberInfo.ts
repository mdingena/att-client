export type GroupMemberInfo = {
  group_id: number;
  user_id: number;
  username?: string;
  bot: boolean;
  icon: number;
  permissions: string;
  role_id: number;
  created_at: string;
  type: string;
};
