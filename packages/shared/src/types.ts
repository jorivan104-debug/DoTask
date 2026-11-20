export type WorkspaceRole = 'owner' | 'member' | 'guest';

import type { Recurrence, TaskImportance, TaskStatus } from './schemas';

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: UserDto;
}

export interface ProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface TaskListDto {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface TaskStepDto {
  id: string;
  taskId: string;
  title: string;
  isChecked: boolean;
  checkedAt: string | null;
  sortOrder: number;
}

export interface CategoryDto {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
}

export interface LinkedResourceDto {
  id: string;
  taskId: string;
  applicationName: string;
  displayName: string;
  externalId: string | null;
  webUrl: string | null;
  mimeType: string | null;
  createdAt: string;
}

export interface TaskDto {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  importance: TaskImportance;
  startAt: string | null;
  dueAt: string | null;
  remindAt: string | null;
  timezone: string | null;
  recurrence: Recurrence | null;
  completedAt: string | null;
  assigneeId: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface TaskCommentDto {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
  user?: UserDto;
}
