import { describe, expect, it } from "vitest";

import {
  blumeTrackOf,
  consentAnswered,
  ctaClicked,
  docsTracked,
  pricingUsed,
} from "../src/lib/site/measurement/events";

// What Blume dispatches, as a test writes it.
interface Dispatched {
  readonly event?: string;
  readonly props?: Readonly<Record<string, number | string>>;
}

const track = (detail: Dispatched) =>
  blumeTrackOf(new CustomEvent("blume:track", { detail }));

describe("the site's own events", () => {
  it("count a call to action only from the lists", () => {
    expect(ctaClicked("get_started", "hero")).toStrictEqual({
      event: "site_cta_clicked",
      properties: { cta: "get_started", place: "hero" },
    });
    expect(ctaClicked("buy_now", "hero")).toBeUndefined();
    expect(ctaClicked("docs", "popup")).toBeUndefined();
    expect(ctaClicked(undefined, "hero")).toBeUndefined();
  });

  it("count the calculator with whole numbers only", () => {
    expect(pricingUsed({ accounts: 150, band: 2 })).toStrictEqual({
      event: "pricing_calculator_used",
      properties: { accounts: 150, band: 2 },
    });
    expect(pricingUsed({ accounts: 1.5, band: 0 })).toBeUndefined();
    expect(pricingUsed({ accounts: -1, band: 0 })).toBeUndefined();
    expect(pricingUsed({ accounts: 3, band: 99 })).toBeUndefined();
  });

  it("send a docs search's length and results, never its text", () => {
    const sent = docsTracked(
      track({
        event: "search",
        props: {
          path: "/fr",
          query: "my secret key",
          queryChars: 13,
          results: 4,
        },
      }) ?? {
        event: "",
        position: undefined,
        queryChars: undefined,
        results: undefined,
      }
    );

    expect(sent).toStrictEqual({
      event: "docs_search_used",
      properties: { query_chars: 13, results: 4 },
    });
    expect(JSON.stringify(sent)).not.toContain("secret");
  });

  it("send nothing for a search whose numbers are not numbers", () => {
    const read = track({
      event: "search",
      props: { queryChars: "13", results: 4 },
    });

    expect(read?.queryChars).toBeUndefined();
    expect(read === undefined ? undefined : docsTracked(read)).toBeUndefined();
  });

  it("send a result's position and an assistant's question without its text", () => {
    const selected = track({
      event: "search_select",
      props: { position: 2, query: "x", url: "/guides" },
    });

    const asked = track({
      event: "ask",
      props: { question: "how do I", questionChars: 8 },
    });

    expect(
      selected === undefined ? undefined : docsTracked(selected)
    ).toStrictEqual({
      event: "docs_search_result_opened",
      properties: { position: 2 },
    });
    expect(asked === undefined ? undefined : docsTracked(asked)).toStrictEqual({
      event: "docs_assistant_asked",
      properties: {},
    });
  });

  it("read nothing from an event that is not Blume's", () => {
    expect(blumeTrackOf(new Event("blume:track"))).toBeUndefined();
    expect(track({ props: {} })).toBeUndefined();
    expect(
      docsTracked({ event: "feedback", position: 1, queryChars: 1, results: 1 })
    ).toBeUndefined();
  });

  it("count an answer to the notice", () => {
    expect(consentAnswered({ answer: "refused" })).toStrictEqual({
      event: "consent_answered",
      properties: { answer: "refused" },
    });
  });
});
