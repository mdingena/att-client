type GroupId = number;

type ServerId = number;

type UserId = number;

export class ApiEndpoint {
  static group = (groupId: GroupId) => `/groups/${groupId}`;

  static groupInvite = (groupId: GroupId) => `/groups/invites/${groupId}`;

  static groupInvites = '/groups/invites';

  static groupMember = (groupId: GroupId, userId: UserId) => `/groups/${groupId}/members/${userId}`;

  static joinedGroups = '/groups/joined';

  static server = (serverId: ServerId) => `/servers/${serverId}`;

  static serverConsole = (serverId: ServerId) => `/servers/${serverId}/console`;

  static sessions = '/sessions';
}
