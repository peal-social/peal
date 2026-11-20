import type { ReactNode } from "react";

import { PealMark } from "#components/shell/peal-mark.tsx";

interface AuthCardProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly footer?: ReactNode;
  readonly title: string;
}

// The column of every sign-in page (DESIGN.md, "sign-in"): no card, on
// the window's background, centred: Peal's mark, the title (the page's
// `h1`) with an optional muted line, what the page holds, then the links
// to the other pages beneath, in muted text. It fades in and rises 8 px
// as a page opens, so going from one page to the next reads as a step;
// with reduced motion it appears at once.
export const AuthCard = ({
  children,
  description,
  footer,
  title,
}: AuthCardProps) => (
  <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto flex w-full max-w-sm flex-col gap-8 py-16 duration-500 ease-out motion-reduce:animate-none">
    <div className="flex flex-col items-center gap-6 text-center">
      <PealMark className="size-12" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description === undefined ? null : (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
    </div>
    {children}
    {footer === undefined ? null : (
      <div className="text-muted-foreground flex flex-col items-center gap-2 text-center text-sm">
        {footer}
      </div>
    )}
  </div>
);
