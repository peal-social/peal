import { Cell } from "peal-ui/blocks/blueprint/cell";
import { CellGrid } from "peal-ui/blocks/blueprint/cell-grid";

import { showcaseHref, showcaseIndex } from "./pages.ts";

// The showcase's index: a cell per kind of block asked for, listing its
// blocks, or saying why it has none. A React component, since an Astro
// page cannot hand a React block an element such as `render={<ul />}`.
export const IndexGrid = () => {
  const groups = showcaseIndex();

  return (
    <CellGrid columns={3} render={<ul />}>
      {groups.map((group) => (
        <Cell key={group.category} render={<li />}>
          <h2 className="text-[15px] font-semibold">{group.category}</h2>
          {group.blocks.length === 0 ? null : (
            <ul className="mt-3 flex flex-col gap-1">
              {group.blocks.map((block) => (
                <li key={block.slug}>
                  <a
                    href={showcaseHref(block.slug)}
                    className="text-brand-text font-mono text-[13px] underline-offset-4 hover:underline"
                  >
                    {block.slug}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {group.note === undefined ? null : (
            <p className="text-muted-foreground mt-3 text-[13px]">
              {group.note}
            </p>
          )}
        </Cell>
      ))}
      {groups.length % 3 === 0 ? null : (
        <Cell
          render={<li />}
          span={groups.length % 3 === 1 ? 2 : 1}
          surface="hatch"
        />
      )}
    </CellGrid>
  );
};
