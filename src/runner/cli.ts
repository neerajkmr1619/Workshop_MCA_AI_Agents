import { pathToFileURL } from "node:url";
import { MissingEnvError, loadEnv, requireEnv } from "@/lib/env";
import { heading } from "@/lib/print";
import { discoverLessons, resolveLesson } from "@/runner/registry";
import { UnknownStepError, clearSteps, getSteps, runSteps } from "@/runner/step";
import type { LessonMeta } from "@/runner/step";

export interface CliOptions {
  query?: string;
  only?: number;
  list: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { query: undefined, only: undefined, list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--list" || arg === "-l") {
      options.list = true;
      continue;
    }

    if (arg === "--step" || arg === "-s") {
      const value = argv[i + 1];
      const parsed = Number(value);
      if (value === undefined || !Number.isInteger(parsed)) {
        throw new Error(`--step expects a number, got ${value ?? "nothing"}`);
      }
      options.only = parsed;
      i += 1;
      continue;
    }

    if (arg.startsWith("--step=")) {
      const value = arg.slice("--step=".length);
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        throw new Error(`--step expects a number, got ${value}`);
      }
      options.only = parsed;
      continue;
    }

    if (!arg.startsWith("-") && options.query === undefined) {
      options.query = arg;
    }
  }

  return options;
}

function printLessonList(lessons: Awaited<ReturnType<typeof discoverLessons>>): void {
  let currentModule = "";
  for (const lesson of lessons) {
    if (lesson.module !== currentModule) {
      currentModule = lesson.module;
      console.log(`\n${currentModule}`);
    }
    console.log(`  ${lesson.id}`);
  }
  console.log(`\nRun one with:  npm run lesson <id>`);
  console.log(`A single step:  npm run lesson <id> -- --step 2\n`);
}

export async function main(argv: string[]): Promise<number> {
  loadEnv();

  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const lessons = await discoverLessons();

  if (options.list || options.query === undefined) {
    printLessonList(lessons);
    return options.list ? 0 : 1;
  }

  const resolution = resolveLesson(options.query, lessons);

  if (resolution.kind === "not-found") {
    console.error(`No lesson matching "${resolution.query}".`);
    console.error(`Run \`npm run lessons\` to see the full list.`);
    return 1;
  }

  if (resolution.kind === "ambiguous") {
    console.error(`"${options.query}" matches more than one lesson:`);
    for (const match of resolution.matches) console.error(`  ${match.id}`);
    return 1;
  }

  const { lesson } = resolution;

  clearSteps();
  const imported: { meta?: LessonMeta } = await import(pathToFileURL(lesson.path).href);
  const meta = imported.meta;

  if (!meta) {
    console.error(`${lesson.id} does not export \`meta\`. Every lesson must.`);
    return 1;
  }

  try {
    for (const variable of meta.requires ?? []) requireEnv(variable);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error(`\n${error.message}\n`);
      return 1;
    }
    throw error;
  }

  heading(`${lesson.id} — ${meta.title}`);

  try {
    await runSteps(getSteps(), { only: options.only });
  } catch (error) {
    if (error instanceof UnknownStepError) {
      console.error(`\n${error.message}\n`);
      return 1;
    }
    throw error;
  }

  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(process.argv.slice(2));
}
