// ui-sdk renders a checkbox's and a switch's native input after the control,
// and a select's after its parts, as their sibling, absolutely positioned
// and visually hidden. Without a
// positioned element around both, the input is laid out against a distant
// ancestor: below the fold of a scrolling panel it stretches the document,
// and the whole frame scrolls with it. Each control keeps its input in a
// positioned box of its own.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "../src/components/checkbox.tsx";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "../src/components/select.tsx";
import { Switch } from "../src/components/switch.tsx";

// The element right around the control and its input, or nothing when the
// input is not inside one.
const boxOf = (html: string, role: string, input: string) =>
  new RegExp(
    `^<span(?<attributes>[^>]*)><button[^>]*role="${role}"[^>]*>[\\s\\S]*?</button><input(?<input>[^>]*data-slot="${input}"[^>]*)/?></span>$`,
    "u"
  ).exec(html)?.groups;

const classesOf = (attributes: string | undefined) =>
  (
    /class="(?<classes>[^"]*)"/u.exec(attributes ?? "")?.groups?.["classes"] ??
    ""
  )
    .split(" ")
    .filter(Boolean);

describe.each([
  {
    control: () => createElement(Checkbox, { name: "terms" }),
    input: "checkbox-input",
    role: "checkbox",
  },
  {
    control: () => createElement(Switch, { name: "alerts" }),
    input: "switch-input",
    role: "switch",
  },
])("the $role's hidden input", ({ control, input, role }) => {
  const html = renderToString(control());
  const box = boxOf(html, role, input);

  it("sits with its control inside a positioned box of their own", () => {
    expect(box).toBeDefined();
    expect(classesOf(box?.["attributes"])).toContain("relative");
  });

  it("stays out of sight and of the tab order, and submits under its name", () => {
    expect(box?.["input"]).toMatch(/aria-hidden="true"/u);
    expect(box?.["input"]).toMatch(/tabindex="-1"/iu);
    expect(box?.["input"]).toMatch(/name="(?:terms|alerts)"/u);
    expect(box?.["input"]).toMatch(/position:absolute/u);
  });

  it("leaves the box the peer a following label reads", () => {
    expect(classesOf(box?.["attributes"])).toContain("peer");
  });
});

// A select's form value is a hidden textarea that ui-sdk renders after the
// select's parts, positioned the same way. Its box is a `span`, valid where
// a select sits inside a `span`, and takes the select's `className`, which
// sets its width in a flex row.
describe("the select's hidden input", () => {
  const html = renderToString(
    createElement(
      Select<string, false>,
      { className: "w-full sm:w-48", defaultValue: "utc", name: "zone" },
      createElement(
        SelectTrigger,
        { "aria-label": "Zone" },
        createElement(SelectValue)
      )
    )
  );

  const box =
    /^<span(?<attributes>[^>]*)><button[^>]*data-slot="select-trigger"[^>]*>[\s\S]*?<\/button><textarea(?<input>[^>]*data-slot="select-form-input"[^>]*)>[^<]*<\/textarea><\/span>$/u.exec(
      html
    )?.groups;

  it("sits with the trigger inside a positioned box of their own", () => {
    expect(box).toBeDefined();
    expect(classesOf(box?.["attributes"])).toContain("relative");
    expect(classesOf(box?.["attributes"])).toContain("block");
  });

  it("gives its box the select's class", () => {
    expect(classesOf(box?.["attributes"])).toEqual(
      expect.arrayContaining(["w-full", "sm:w-48"])
    );
  });

  it("stays out of sight and submits under the select's name", () => {
    expect(box?.["input"]).toMatch(/aria-hidden="true"/u);
    expect(box?.["input"]).toMatch(/name="zone"/u);
    expect(box?.["input"]).toMatch(/position:absolute/u);
  });
});
