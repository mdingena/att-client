export type GroupInfo = {
  id: number;
  name?: string;
  description?: string;
  member_count: number;
  created_at: string;
  type: string;
  tags?: string[];
};
