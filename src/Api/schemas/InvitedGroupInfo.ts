import type { GroupInfo } from './GroupInfo';

export type InvitedGroupInfo = GroupInfo & {
  invited_at: string;
};
