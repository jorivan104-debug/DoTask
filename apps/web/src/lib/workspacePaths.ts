export function workspaceTaskBoardPath(
  workspaceId: string,
  projectId: string,
  milestoneId: string,
  listId: string,
) {
  return `/workspaces/${workspaceId}/p/${projectId}/m/${milestoneId}/l/${listId}`;
}

export function projectDetailPath(
  workspaceId: string,
  projectId: string,
) {
  return `/workspaces/${workspaceId}/p/${projectId}`;
}

export function workspaceRootPath(workspaceId: string) {
  return `/workspaces/${workspaceId}`;
}
