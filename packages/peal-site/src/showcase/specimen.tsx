"use client";

import { registry } from "./registry.tsx";

// One specimen of a block, found by the block's path and the specimen's
// place: the only props an island can take from an Astro page are JSON,
// and a specimen's content may hold elements. The page renders a static
// block's specimens on the server, and hydrates an interactive one's.
export const Specimen = ({
  index,
  slug,
}: {
  readonly index: number;
  readonly slug: string;
}) =>
  registry
    .find((entry) => entry.slug === slug)
    ?.specimens.at(index)
    ?.render() ?? null;
