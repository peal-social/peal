"use client";

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { AtomRegistry } from "effect/reactivity";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { renderRegistry } from "#api/registry.ts";

// As the library's own provider waits before disposing of its registry: a
// remount at once (Strict Mode, Fast Refresh) keeps the same one.
const disposalDelayMs = 500;

/**
 * The atom registry of every page, one per visitor (also during server
 * rendering, so requests never share state), which holds a query a render
 * reads until that render commits (`renderRegistry`, `#api/registry.ts`).
 */
export const AppRegistryProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const registry = useMemo(
    () => renderRegistry(AtomRegistry.make({ scheduleTask })),
    []
  );

  const disposal = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Effects run in the browser alone, where commits subscribe.
  useEffect(() => {
    clearTimeout(disposal.current);

    const stopHolding = registry.holdRenders();

    return () => {
      stopHolding();
      disposal.current = setTimeout(() => {
        registry.dispose();
      }, disposalDelayMs);
    };
  }, [registry]);

  return <RegistryContext value={registry}>{children}</RegistryContext>;
};
