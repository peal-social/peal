import { describe, expect, it } from "bun:test";

import { namespaceProblems, namespacesOf } from "./sdk-names.ts";

describe("the namespaces the generators make", () => {
  it("counts a namespace that holds no operation of its own", () => {
    expect([
      ...namespacesOf([{ method: "send", namespace: "inbox.messages" }]),
    ]).toEqual(["inbox", "inbox.messages"]);
  });
});

describe("what stops the SDKs' document", () => {
  it("finds none in namespaces that end each their own way", () => {
    expect(
      namespaceProblems([
        { method: "send", namespace: "inbox.messages" },
        { method: "list", namespace: "automations.queues" },
        { method: "get", namespace: "posts" },
      ])
    ).toEqual([]);
  });

  it("refuses a namespace ending like a parent that holds no operation", () => {
    expect(
      namespaceProblems([
        { method: "send", namespace: "inbox.messages" },
        { method: "list", namespace: "partner.inbox" },
      ])
    ).toEqual([
      "The SDKs' namespaces inbox and partner.inbox end alike: rename one",
    ]);
  });

  it("refuses a method named as a namespace below a parent with no operation", () => {
    expect(
      namespaceProblems([
        { method: "list", namespace: "automations.queues.slots" },
        { method: "queues", namespace: "automations" },
      ])
    ).toEqual([
      "The method automations.queues has the name of a namespace beside it",
    ]);
  });

  it("refuses two namespaces that end alike, and one called peal", () => {
    expect(
      namespaceProblems([
        { method: "get", namespace: "workspace.usage" },
        { method: "get", namespace: "partner.usage" },
        { method: "get", namespace: "peal" },
      ])
    ).toEqual([
      "The SDKs' namespaces workspace.usage and partner.usage end alike: rename one",
      "No SDK namespace may be called peal: peal",
    ]);
  });
});
