import { JobStatus } from '@ff-converter/shared-types';

const ALLOWED_TRANSITIONS: Record<JobStatus, ReadonlySet<JobStatus>> = {
  DISCOVERED: new Set(['PENDING_ANALYSIS', 'SKIPPED', 'FAILED']),
  PENDING_ANALYSIS: new Set(['ANALYZING', 'QUEUED', 'SKIPPED', 'FAILED']),
  ANALYZING: new Set(['READY', 'RUNNING', 'FAILED', 'CANCELLING', 'INTERRUPTED']),
  READY: new Set(['QUEUED', 'SKIPPED']),
  QUEUED: new Set(['ANALYZING', 'RUNNING', 'WAITING_FOR_SPACE', 'CANCELLING', 'CANCELLED', 'FAILED']),
  RUNNING: new Set(['PAUSED', 'CANCELLING', 'VALIDATING_OUTPUT', 'FAILED', 'INTERRUPTED']),
  PAUSED: new Set(['RUNNING', 'CANCELLING', 'INTERRUPTED']),
  CANCELLING: new Set(['CANCELLED', 'FAILED']),
  CANCELLED: new Set(['QUEUED']),
  FAILED: new Set(['QUEUED']),
  COMPLETED: new Set(),
  INTERRUPTED: new Set(['QUEUED', 'CANCELLED']),
  SKIPPED: new Set(['QUEUED']),
  VALIDATING_OUTPUT: new Set(['COMPLETED', 'FAILED', 'INTERRUPTED']),
  WAITING_FOR_FILE: new Set(['QUEUED', 'SKIPPED', 'CANCELLED']),
  WAITING_FOR_SPACE: new Set(['QUEUED', 'CANCELLED']),
  NEEDS_ATTENTION: new Set(['QUEUED', 'SKIPPED', 'CANCELLED'])
};

export class JobStateMachine {
  public canTransition(fromStatus: JobStatus, toStatus: JobStatus): boolean {
    return fromStatus === toStatus || ALLOWED_TRANSITIONS[fromStatus].has(toStatus);
  }

  public assertTransition(fromStatus: JobStatus, toStatus: JobStatus): void {
    if (!this.canTransition(fromStatus, toStatus)) {
      throw new Error(`Invalid job transition: ${fromStatus} -> ${toStatus}`);
    }
  }
}
