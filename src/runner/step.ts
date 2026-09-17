import { heading } from "@/lib/print";

/** Declared by every lesson module as `export const meta`. */
export interface LessonMeta {
  /** Human-readable lesson title, shown when the lesson runs. */
  title: string;
  /** Environment variables the lesson cannot run without. */
  requires?: string[];
  /** Variables that unlock some steps but are not fatal if absent. */
  optional?: string[];
}

export interface Step {
  n: number;
  title: string;
  fn: () => void | Promise<void>;
}

export class UnknownStepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownStepError";
  }
}

const registry: Step[] = [];

/**
 * Register one step of a lesson. Called at module scope; the runner imports
 * the lesson module and then executes whatever was registered.
 */
export function step(n: number, title: string, fn: () => void | Promise<void>): void {
  if (registry.some((s) => s.n === n)) {
    throw new Error(`Duplicate step number ${n} ("${title}")`);
  }
  registry.push({ n, title, fn });
}

export function getSteps(): Step[] {
  return [...registry].sort((a, b) => a.n - b.n);
}

export function clearSteps(): void {
  registry.length = 0;
}

export async function runSteps(
  steps: Step[],
  options: { only?: number } = {},
): Promise<void> {
  let selected = steps;

  if (options.only !== undefined) {
    selected = steps.filter((s) => s.n === options.only);
    if (selected.length === 0) {
      const available = steps.map((s) => s.n).join(", ");
      throw new UnknownStepError(
        `No step ${options.only} in this lesson. Available steps: ${available}`,
      );
    }
  }

  for (const s of selected) {
    heading(`Step ${s.n}: ${s.title}`);
    await s.fn();
  }
}
