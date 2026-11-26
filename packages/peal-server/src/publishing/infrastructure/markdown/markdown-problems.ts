import type { Nodes } from "mdast";

import { maxBodyProblems } from "#publishing/domain/body-problem.ts";
import type {
  BodyProblem,
  BodyProblemKind,
} from "#publishing/domain/body-problem.ts";

/**
 * The problems a walk of the Markdown's tree finds, each at the place its
 * node starts, once a place and a kind, the first `maxBodyProblems` alone.
 */
export class MarkdownProblems {
  readonly found: BodyProblem[] = [];

  private readonly seen = new Set<string>();

  add(problem: BodyProblemKind, node?: Nodes): void {
    const start = node?.position?.start;
    const key = `${problem}:${start?.line ?? 0}:${start?.column ?? 0}`;

    if (this.seen.has(key) || this.found.length >= maxBodyProblems) {
      return;
    }

    this.seen.add(key);
    this.found.push(
      start === undefined
        ? { problem }
        : { column: start.column, line: start.line, problem }
    );
  }
}
