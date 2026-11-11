import { UserRow, WorkspaceRole } from '../../core/api/contracts';
import { ChipTone } from '../../shared/ui';

/** Shared by the Users (platform) and Team (workspace) screens. */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  org_admin: 'Org admin',
  consultant: 'Consultant',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

export const STATUS: Record<UserRow['status'], { label: string; tone: ChipTone }> = {
  active: { label: 'Active', tone: 'green' },
  invited: { label: 'Invited', tone: 'amber' },
  disabled: { label: 'Disabled', tone: 'red' },
};
