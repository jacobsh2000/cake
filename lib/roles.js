// Admin roles, tagged on the Clerk user as publicMetadata.role.
//
// Two tiers:
//   admin       — the full dashboard: review, approve, reject, revert,
//                 cancel, assign, and approve volunteers.
//   coordinator — matchmaking only: assign and reassign volunteers to
//                 already-approved requests. Cannot see the review
//                 queue, cannot approve or cancel anything, cannot
//                 approve volunteers.
//
// Every one of these is re-checked inside the server action itself.
// Hiding a tab decides what's convenient to reach; it decides nothing
// about what a crafted POST can do.
export const ROLE_ADMIN = "admin";
export const ROLE_COORDINATOR = "coordinator";

export function roleOf(clerkUser) {
  return clerkUser?.publicMetadata?.role || null;
}

// Full admin powers: the review queue and every state transition.
export function canManageRequests(role) {
  return role === ROLE_ADMIN;
}

// Matchmaking: putting a volunteer on a request. Both tiers.
export function canAssignVolunteers(role) {
  return role === ROLE_ADMIN || role === ROLE_COORDINATOR;
}

// Whether this role may reach /admin at all.
export function canReachAdmin(role) {
  return canAssignVolunteers(role);
}
