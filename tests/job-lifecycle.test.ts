import { describe, expect, it } from 'vitest';
import { JobStateMachine, ProcessRunner, resolveConcurrencyLimit } from '../packages/media-core/src';
import { JobPrioritySchema } from '../packages/shared-contracts/src';

describe('JobStateMachine', () => {
  const stateMachine = new JobStateMachine();

  it('allows the normal conversion lifecycle', () => {
    expect(stateMachine.canTransition('QUEUED', 'ANALYZING')).toBe(true);
    expect(stateMachine.canTransition('ANALYZING', 'RUNNING')).toBe(true);
    expect(stateMachine.canTransition('RUNNING', 'VALIDATING_OUTPUT')).toBe(true);
    expect(stateMachine.canTransition('VALIDATING_OUTPUT', 'COMPLETED')).toBe(true);
  });

  it('allows recovery, retry and disk-space cycles', () => {
    expect(stateMachine.canTransition('RUNNING', 'INTERRUPTED')).toBe(true);
    expect(stateMachine.canTransition('INTERRUPTED', 'QUEUED')).toBe(true);
    expect(stateMachine.canTransition('QUEUED', 'WAITING_FOR_SPACE')).toBe(true);
    expect(stateMachine.canTransition('WAITING_FOR_SPACE', 'QUEUED')).toBe(true);
    expect(stateMachine.canTransition('FAILED', 'QUEUED')).toBe(true);
    expect(stateMachine.canTransition('CANCELLED', 'QUEUED')).toBe(true);
  });

  it('rejects invalid terminal-state transitions', () => {
    expect(() => stateMachine.assertTransition('COMPLETED', 'RUNNING')).toThrow();
    expect(() => stateMachine.assertTransition('SKIPPED', 'COMPLETED')).toThrow();
    expect(() => stateMachine.assertTransition('FAILED', 'COMPLETED')).toThrow();
  });
});

describe('Queue contracts', () => {
  it('validates bounded integer priorities', () => {
    expect(JobPrioritySchema.parse({ id: 'job-1', priority: 25 }).priority).toBe(25);
    expect(() => JobPrioritySchema.parse({ id: 'job-1', priority: 1.5 })).toThrow();
    expect(() => JobPrioritySchema.parse({ id: 'job-1', priority: 1001 })).toThrow();
  });

  it('never lets automatic concurrency exceed the configured maximum', () => {
    expect(resolveConcurrencyLimit(2, true, 3)).toBe(2);
    expect(resolveConcurrencyLimit(4, true, 2)).toBe(2);
    expect(resolveConcurrencyLimit(3, false, 1)).toBe(3);
  });
});

describe('ProcessRunner progress smoothing', () => {
  it('uses recent speed samples to stabilize ETA', () => {
    const runner = new ProcessRunner({
      ffmpegPath: 'unused',
      args: [],
      jobId: 'job-progress',
      totalDurationSeconds: 100
    });
    const payloads: any[] = [];
    runner.on('progress', (payload) => payloads.push(payload));

    (runner as any).emitProgress({
      out_time_us: '10000000',
      fps: '30',
      speed: '1x',
      bitrate: '1000kbits/s'
    });
    (runner as any).emitProgress({
      out_time_us: '10000000',
      fps: '30',
      speed: '3x',
      bitrate: '1000kbits/s'
    });

    expect(payloads[0].etaSeconds).toBe(90);
    expect(payloads[1].etaSeconds).toBe(45);
  });
});
