"use client";

import { RegistryContext, RegistryProvider } from "@effect/atom-react";
import { useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";

import { renderRegistry } from "#api/registry.ts";

// The library's registry, as React reads it: what a render reads is held
// until its commit subscribes. The library's provider keeps the registry
// and disposes of it; this one only holds, and lets go when it unmounts.
const RenderHolds = ({ children }: { readonly children: ReactNode }) => {
  const inner = useContext(RegistryContext);
  const registry = useMemo(() => renderRegistry(inner), [inner]);

  // Effects run in the browser alone, where commits subscribe; the
  // function `holdRenders` answers stops holding and clears every timer.
  useEffect(() => registry.holdRenders(), [registry]);

  return <RegistryContext value={registry}>{children}</RegistryContext>;
};

/**
 * The atom registry of every page, one per visitor (also during server
 * rendering, so requests never share state): the library's, which holds a
 * query a render reads until that render commits (`renderRegistry`,
 * `#api/registry.ts`).
 */
export const AppRegistryProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <RegistryProvider>
    <RenderHolds>{children}</RenderHolds>
  </RegistryProvider>
);
