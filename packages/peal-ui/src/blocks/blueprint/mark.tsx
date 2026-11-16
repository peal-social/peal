import { cn } from "../../lib/utils";

/**
 * A brand's own mark (DESIGN.md, Icons): a simple-icons path, drawn in
 * currentColor, or the letters of a lettered tile for a brand that has no
 * mark there. The page passes the path, so peal-ui holds no logo.
 */
type SiteMark =
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "letters"; readonly letters: string };

/** A brand's mark at 16 px by default, hidden from screen readers. */
const Mark = ({
  className,
  mark,
}: {
  readonly className?: string | undefined;
  readonly mark: SiteMark;
}) =>
  mark.kind === "path" ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      data-slot="mark"
      className={cn("size-4 shrink-0", className)}
    >
      <path d={mark.path} />
    </svg>
  ) : (
    <span
      aria-hidden="true"
      data-slot="mark"
      className={cn(
        className,
        "bg-foreground text-background flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] leading-none font-semibold"
      )}
    >
      {mark.letters}
    </span>
  );

export { Mark };

export type { SiteMark };
