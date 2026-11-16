import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Cell } from "../../../src/blocks/blueprint/cell";
import { CellGrid } from "../../../src/blocks/blueprint/cell-grid";

describe("CellGrid", () => {
  it("is one column on a phone and as many as asked from 1024 px", () => {
    const markup = renderToStaticMarkup(<CellGrid columns={4} />);

    expect(markup).toContain("grid-cols-1 sm:grid-cols-2 lg:grid-cols-4");
  });

  it("has three columns by default", () => {
    expect(renderToStaticMarkup(<CellGrid />)).toContain('data-columns="3"');
  });

  it("renders a list of cells", () => {
    const markup = renderToStaticMarkup(
      <CellGrid render={<ul />}>
        <Cell render={<li />}>One</Cell>
        <Cell render={<li />}>Two</Cell>
      </CellGrid>
    );

    expect(markup).toMatch(/^<ul [^>]*data-slot="cell-grid"/u);
    expect(markup.match(/<li /gu)).toHaveLength(2);
    expect(markup).toContain(">One</li>");
  });
});
