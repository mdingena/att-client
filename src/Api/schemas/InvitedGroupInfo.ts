import type { GroupInfo } from './GroupInfo.js';

export type InvitedGroupInfo = GroupInfo & {
  invited_at: string;
};
