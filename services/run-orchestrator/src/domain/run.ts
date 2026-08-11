import { createHash } from 'node:crypto';
import type { ArtifactId, BlueprintId, RunId, TenantId } from '@helixworks/contracts';

export type RunState = 'running' | 'completed' | 'cancelled' | 'compensated';
export class InvalidRunStateError extends Error {}
export class RunBudgetExceededError extends Error {}

export interface RunSnapshot {
  readonly tenantId: TenantId;
  readonly runId: RunId;
  readonly blueprintId: BlueprintId;
  readonly blueprintDigest: string;
  readonly maxSteps: number;
  readonly maxCostUsd: number;
  readonly stepsUsed: number;
  readonly costUsd: number;
  readonly state: RunState;
  readonly artifactId: ArtifactId | null;
  readonly artifactDigest: string | null;
}

export class Run {
  #stepsUsed: number;
  #costUsd: number;
  #state: RunState;
  #artifactId: ArtifactId | null;
  #artifactDigest: string | null;

  public constructor(
    private readonly data: Omit<
      RunSnapshot,
      'stepsUsed' | 'costUsd' | 'state' | 'artifactId' | 'artifactDigest'
    >,
  ) {
    this.#stepsUsed = 0;
    this.#costUsd = 0;
    this.#state = 'running';
    this.#artifactId = null;
    this.#artifactDigest = null;
  }

  public consume(costUsd: number): void {
    this.assertRunning();
    if (!Number.isFinite(costUsd) || costUsd < 0)
      throw new RunBudgetExceededError('Step cost must be non-negative');
    if (
      this.#stepsUsed + 1 > this.data.maxSteps ||
      this.#costUsd + costUsd > this.data.maxCostUsd
    ) {
      throw new RunBudgetExceededError('Run budget exceeded');
    }
    this.#stepsUsed += 1;
    this.#costUsd = Math.round((this.#costUsd + costUsd) * 100) / 100;
  }

  public complete(artifactId: ArtifactId, artifact: string): string {
    this.assertRunning();
    if (this.#stepsUsed === 0) throw new InvalidRunStateError('Cannot complete an empty run');
    this.#artifactId = artifactId;
    this.#artifactDigest = `sha256:${createHash('sha256').update(artifact).digest('hex')}`;
    this.#state = 'completed';
    return this.#artifactDigest;
  }

  public cancel(): void {
    this.assertRunning();
    this.#state = 'cancelled';
  }
  public compensate(): void {
    if (this.#state !== 'cancelled')
      throw new InvalidRunStateError('Only a cancelled run can be compensated');
    this.#state = 'compensated';
  }
  public snapshot(): RunSnapshot {
    return Object.freeze({
      ...this.data,
      stepsUsed: this.#stepsUsed,
      costUsd: this.#costUsd,
      state: this.#state,
      artifactId: this.#artifactId,
      artifactDigest: this.#artifactDigest,
    });
  }
  private assertRunning(): void {
    if (this.#state !== 'running') throw new InvalidRunStateError(`Run is ${this.#state}`);
  }
}
