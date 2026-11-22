import { Effect, Layer } from "effect";

import { ProbeSlots } from "#media/application/ports/probe-slots.ts";
import { probesAtOnce } from "#media/domain/probe-limits.ts";
import { countedSlots } from "#shared/infrastructure/counted-slots.ts";

/**
 * ProbeSlots counted in this process: a probe runs where its request
 * came, so each server bounds its own memory and processes.
 */
export const CountedProbeSlots = Layer.effect(
  ProbeSlots,
  countedSlots(probesAtOnce).pipe(Effect.map((take) => ProbeSlots.of({ take })))
);
