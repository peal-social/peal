import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PixelImage } from "../../../src/blocks/art/pixel-image";

describe("PixelImage", () => {
  it("serves the image with its alt, and a hidden canvas over it", () => {
    const markup = renderToStaticMarkup(
      <PixelImage
        alt="A synthetic picture"
        height={90}
        src="/synthetic.png"
        width={160}
      />
    );

    expect(markup).toContain('alt="A synthetic picture"');
    expect(markup).toContain('src="/synthetic.png"');
    expect(markup).toContain('width="160"');
    expect(markup).toContain('height="90"');
    expect(markup).toContain('<canvas aria-hidden="true"');
    expect(markup).not.toContain("opacity-0");
  });
});
