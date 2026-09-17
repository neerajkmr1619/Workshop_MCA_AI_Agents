import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { lessonsDir } from "@/lib/paths";

export interface LessonRef {
  /** Filename without extension, e.g. "1.1-prompting". */
  id: string;
  /** Containing directory, e.g. "module-1". */
  module: string;
  /** Absolute path to the lesson file. */
  path: string;
}

export type Resolution =
  | { kind: "found"; lesson: LessonRef }
  | { kind: "ambiguous"; matches: LessonRef[] }
  | { kind: "not-found"; query: string };

/**
 * Match a user-supplied lesson query. An exact id always wins; otherwise a
 * prefix match resolves when it is unique.
 */
export function resolveLesson(query: string, lessons: LessonRef[]): Resolution {
  const needle = query.trim().toLowerCase();

  const exact = lessons.find((l) => l.id.toLowerCase() === needle);
  if (exact) return { kind: "found", lesson: exact };

  const matches = lessons.filter((l) => l.id.toLowerCase().startsWith(needle));
  if (matches.length === 1) return { kind: "found", lesson: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", matches };

  return { kind: "not-found", query };
}

/** Walk lessons/<module-*>/<id>.ts and build the lesson list. */
export async function discoverLessons(dir: string = lessonsDir): Promise<LessonRef[]> {
  const lessons: LessonRef[] = [];
  const modules = await readdir(dir, { withFileTypes: true });

  for (const moduleDir of modules) {
    if (!moduleDir.isDirectory()) continue;
    const files = await readdir(join(dir, moduleDir.name));
    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      lessons.push({
        id: basename(file, ".ts"),
        module: moduleDir.name,
        path: join(dir, moduleDir.name, file),
      });
    }
  }

  return lessons.sort((a, b) =>
    a.module === b.module ? a.id.localeCompare(b.id) : a.module.localeCompare(b.module),
  );
}
