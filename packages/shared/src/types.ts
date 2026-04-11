export type WorkspaceRole = 'owner' | 'member' | 'guest';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

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

export interface MilestoneDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  targetDate: string | null;
  achievedAt: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface TaskListDto {
  id: string;
  milestoneId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface TaskDto {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  remindAt: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  parentTaskId: string | null;
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
