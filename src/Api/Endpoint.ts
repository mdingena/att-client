export const enum Endpoint {
  AcceptGroupInvite = '/groups/invites/{groupId}',
  GroupInfo = '/groups/{groupId}',
  GroupInvites = '/groups/invites',
  GroupMember = '/groups/{groupId}/members/{userId}',
  JoinedGroups = '/groups/joined',
  ServerInfo = '/servers/{serverId}',
  ServerConsole = '/servers/{serverId}/console'
}
