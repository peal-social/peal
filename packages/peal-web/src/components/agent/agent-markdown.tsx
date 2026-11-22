import type { ReactNode } from "react";

import { parseMarkdown } from "#agent/markdown.ts";
import type { Inline } from "#agent/markdown.ts";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";

const linkClass =
  "text-brand-text underline underline-offset-2 hover:no-underline";

const InlineNodes = ({
  link: AppLink,
  nodes,
}: {
  readonly link: LinkComponent;
  readonly nodes: readonly Inline[];
}): ReactNode =>
  nodes.map((node, index) => {
    // Nodes have no identity of their own: their place in the text is it.
    const key = `${node._tag}-${String(index)}`;

    switch (node._tag) {
      case "break": {
        return <br key={key} />;
      }

      case "code": {
        return (
          <code
            key={key}
            className="bg-muted rounded-sm px-1 py-0.5 font-mono text-xs"
          >
            {node.text}
          </code>
        );
      }

      case "em": {
        return (
          <em key={key}>
            <InlineNodes link={AppLink} nodes={node.children} />
          </em>
        );
      }

      case "strong": {
        return (
          <strong key={key} className="font-semibold">
            <InlineNodes link={AppLink} nodes={node.children} />
          </strong>
        );
      }

      case "link": {
        return node.internal ? (
          <AppLink key={key} href={node.href} className={linkClass}>
            <InlineNodes link={AppLink} nodes={node.children} />
          </AppLink>
        ) : (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <InlineNodes link={AppLink} nodes={node.children} />
          </a>
        );
      }

      case "text": {
        return node.text;
      }

      default: {
        return null;
      }
    }
  });

/**
 * The agent's answer: the markdown it may write (paragraphs, lists, bold,
 * italics, inline code, links), as elements, never as HTML. A path of this
 * origin opens through the app's `link`; any other address in a new tab.
 */
export const AgentMarkdown = ({
  link,
  text,
}: {
  readonly link: LinkComponent;
  readonly text: string;
}) => (
  <div dir="auto" className="flex flex-col gap-3 text-sm leading-relaxed">
    {parseMarkdown(text).map((block, index) => {
      const key = `${block._tag}-${String(index)}`;

      if (block._tag === "paragraph") {
        return (
          <p key={key}>
            <InlineNodes link={link} nodes={block.children} />
          </p>
        );
      }

      const items = block.items.map((item, at) => (
        <li key={`item-${String(at)}`}>
          <InlineNodes link={link} nodes={item} />
        </li>
      ));

      return block.ordered ? (
        <ol key={key} className="flex list-decimal flex-col gap-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={key} className="flex list-disc flex-col gap-1 pl-5">
          {items}
        </ul>
      );
    })}
  </div>
);
