export function workspaceTaskBoardPath(
  workspaceId: string,
  projectId: string,
  milestoneId: string,
  listId: string,
) {
  return `/workspaces/${workspaceId}/p/${projectId}/m/${milestoneId}/l/${listId}`;
}

export function workspaceRootPath(workspaceId: string) {
  return `/workspaces/${workspaceId}`;
}
