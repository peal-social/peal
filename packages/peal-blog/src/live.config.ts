// EmDash's content, from its database: one live collection that every query
// of `emdash` (getEmDashCollection, getEmDashEntry) reads.
import { defineLiveCollection } from "astro:content";
import { emdashLoader } from "emdash/runtime";

export const collections = {
  _emdash: defineLiveCollection({ loader: emdashLoader() }),
};
