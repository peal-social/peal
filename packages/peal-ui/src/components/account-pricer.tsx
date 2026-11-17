"use client";

import {
  Slider,
  SliderControl,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type * as React from "react";

import { graduatedTotal } from "../lib/graduated";
import type { PriceBand } from "../lib/graduated";
import { cn } from "../lib/utils";
import { Button, buttonVariants } from "./button";
import { Input } from "./input";

/** Every word the calculator shows; `{name}` marks a value it fills in. */
interface AccountPricerText {
  /** The month's price per account on average: `{price}`. */
  readonly average: string;
  readonly cloud: { readonly line: string; readonly title: string };
  /** The − and + buttons beside the count, for a screen reader. */
  readonly decrease: string;
  readonly excluded: string;
  readonly free: string;
  readonly increase: string;
  /** What the count is, for the field and the slider. */
  readonly label: string;
  /** The top band's range: `{from}`. */
  readonly last: string;
  readonly perAccount: string;
  readonly perMonth: string;
  /** A band's range: `{from}` and `{to}`. */
  readonly range: string;
  /** The slider's value for a screen reader: `{count}`. */
  readonly valueText: string;
}

interface AccountPricerProps {
  /** The rate card's bands, in cents a month per account. */
  readonly bands: readonly PriceBand[];
  /** The plans beside it, as cells of their own: self-hosted, enterprise. */
  readonly children?: React.ReactNode;
  /** Under the plan's price, such as what every account includes. */
  readonly cloudItems?: readonly string[] | undefined;
  /** The way in, such as "Get started" to the app's sign-up. */
  readonly cta?: { readonly href: string; readonly label: string } | undefined;
  /** The count it opens on. */
  readonly initial: number;
  readonly locale: string;
  /** The slider's last count; the field takes more. */
  readonly max: number;
  readonly text: AccountPricerText;
}

// The slider moves in a thousand steps; each band takes a share of the
// track, so the first accounts are as easy to pick as the thousandth.
const steps = 1000;

const weights = [1, 1.3, 1.7, 1.7];

// The field takes counts past the slider's end, up to this.
// The field takes any count; this only keeps it a number a person types.
const largest = 99_999_999;

// What each key adds to the count on the slider.
const keySteps = new Map([
  ["ArrowDown", -1],
  ["ArrowLeft", -1],
  ["ArrowRight", 1],
  ["ArrowUp", 1],
  ["PageDown", -10],
  ["PageUp", 10],
]);

// A band's stop on the track, two by two pixels, once passed: yellow on
// top, as the pixel art's tops.
const stopTones = ["bg-sun", "bg-lavender", "bg-brand", "bg-brand"] as const;

// The pixels a band change throws off the thumb: the mark's colours.
const burstTones = ["var(--brand)", "var(--lavender)", "var(--sun)"] as const;

const fill = (template: string, values: Readonly<Record<string, string>>) =>
  template.replaceAll(
    /\{(?<name>\w+)\}/gu,
    (whole, name: string) => values[name] ?? whole
  );

/** A band's stretch of the track: its counts and its steps. */
interface Segment {
  readonly band: PriceBand;
  readonly end: number;
  /** The band's first count, for its label. */
  readonly first: number;
  /** The count at its start: the band before's last, or 0. */
  readonly from: number;
  readonly start: number;
  readonly to: number;
}

const segmentsOf = (bands: readonly PriceBand[], max: number): Segment[] => {
  const total = bands.reduce(
    (sum, _band, index) => sum + (weights[index] ?? 1),
    0
  );

  const segments: Segment[] = [];
  let start = 0;
  let from = 0;

  for (const [index, band] of bands.entries()) {
    const end = start + (steps * (weights[index] ?? 1)) / total;
    const to = band.upTo ?? max;

    segments.push({ band, end, first: from + 1, from, start, to });
    start = end;
    from = to;
  }

  return segments;
};

// The open band, which has no last account, runs on a logarithmic scale,
// so a hundred more accounts move it as much at a thousand as ten more
// do at a hundred.
const isOpen = (segment: Segment) => segment.band.upTo === null;

const accountsAt = (segments: readonly Segment[], position: number) => {
  const segment =
    segments.find((each) => position <= each.end) ?? segments.at(-1);

  if (segment === undefined) {
    return 0;
  }

  const share = Math.max(
    0,
    (position - segment.start) / (segment.end - segment.start)
  );

  return Math.round(
    isOpen(segment)
      ? segment.from * (segment.to / segment.from) ** share
      : segment.from + share * (segment.to - segment.from)
  );
};

const positionOf = (segments: readonly Segment[], accounts: number) => {
  const segment =
    segments.find((each) => accounts <= each.to) ?? segments.at(-1);

  if (segment === undefined) {
    return 0;
  }

  const share = Math.min(
    1,
    isOpen(segment)
      ? Math.log(Math.max(accounts, segment.from) / segment.from) /
          Math.log(segment.to / segment.from)
      : (accounts - segment.from) / (segment.to - segment.from)
  );

  return segment.start + share * (segment.end - segment.start);
};

/** The band a count falls in, by its index. */
const bandIndexOf = (bands: readonly PriceBand[], accounts: number) =>
  Math.max(
    0,
    bands.findIndex((band) => band.upTo === null || accounts <= band.upTo)
  );

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// How long a figure takes to count to its new value.
const countMs = 260;

/**
 * A number that counts to `target` over `countMs`, easing out, from where
 * it was; at once for a reader who asks for reduced motion.
 */
const useCountUp = (target: number) => {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const origin = from.current;

    // At once, in one frame, when nothing moves or motion is reduced.
    const duration = origin === target || reducedMotion() ? 0 : countMs;

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress =
        duration === 0 ? 1 : Math.min(1, (now - start) / duration);

      const value = origin + (target - origin) * (1 - (1 - progress) ** 3);

      from.current = value;
      setShown(value);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return shown;
};

/**
 * Throws a few pixels off `origin` whenever `band` changes: a small
 * reward for reaching a cheaper band, or a nudge back. Nothing on the
 * first render, nothing with reduced motion.
 */
const useBandBurst = (band: number) => {
  const origin = useRef<HTMLSpanElement>(null);
  const previous = useRef(band);

  useEffect(() => {
    const element = origin.current;

    if (previous.current === band) {
      return;
    }

    previous.current = band;

    if (element === null || reducedMotion()) {
      return;
    }

    for (let index = 0; index < 14; index += 1) {
      const pixel = document.createElement("span");
      const angle = (index / 14) * Math.PI * 2 + Math.random() * 0.4;
      const reach = 26 + Math.random() * 26;

      pixel.style.cssText = `position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:1px;background:${burstTones[index % burstTones.length] ?? "var(--brand)"};pointer-events:none;`;
      element.append(pixel);

      pixel
        .animate(
          [
            { opacity: 1, transform: "translate(0, 0) scale(1)" },
            {
              opacity: 0,
              transform: `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach}px) scale(0.4)`,
            },
          ],
          {
            duration: 650 + Math.random() * 250,
            easing: "cubic-bezier(.2,.7,.3,1)",
          }
        )
        .addEventListener("finish", () => {
          pixel.remove();
        });
    }
  }, [band]);

  return origin;
};

/**
 * A pricing calculator for graduated per-account prices (DESIGN.md, Account
 * calculator): the count, typed, stepped or slid along a track whose
 * stretches are the price bands; a chip per band in use; then the month's
 * total and the average per account, in a plan cell beside what
 * `children` holds.
 */
const AccountPricer = ({
  bands,
  children,
  cloudItems,
  cta,
  initial,
  locale,
  max,
  text,
}: AccountPricerProps) => {
  const [accounts, setAccounts] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const field = useId();
  const segments = segmentsOf(bands, max);
  const position = positionOf(segments, accounts);
  const bandIndex = bandIndexOf(bands, accounts);
  const burst = useBandBurst(bandIndex);

  const count = (value: number) => new Intl.NumberFormat(locale).format(value);

  const dollars = (cents: number) =>
    new Intl.NumberFormat(locale, {
      currency: "USD",
      maximumFractionDigits: 2,
      // A whole amount without its cents ($40), any other with both ($41.40).
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      style: "currency",
    }).format(cents / 100);

  const settle = (value: number) => {
    setAccounts(Math.min(largest, Math.max(0, Math.round(value))));
  };

  const total = graduatedTotal(bands, accounts);
  const shownTotal = useCountUp(total);
  const band = bands[bandIndex];
  const percent = `${(position / steps) * 100}%`;

  // The average per account, for a total.
  const totals = (cents: number) =>
    fill(text.average, { price: dollars(cents / Math.max(1, accounts)) });

  return (
    <div data-slot="account-pricer">
      <div className="flex flex-col items-center gap-10 border-b px-6 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col items-center gap-2">
          <label
            htmlFor={field}
            className="text-muted-foreground font-mono text-xs tracking-[0.04em]"
          >
            {text.label}
          </label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label={text.decrease}
              disabled={accounts === 0}
              onClick={() => {
                settle(accounts - 1);
              }}
            >
              <MinusIcon aria-hidden />
            </Button>
            <Input
              id={field}
              type="number"
              inputMode="numeric"
              min={0}
              max={largest}
              value={String(accounts)}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const value = Math.trunc(Number(event.target.value));

                settle(Number.isNaN(value) ? 0 : value);
              }}
              style={{ "--digits": `${String(accounts).length + 1}ch` }}
              className="h-auto w-(--digits) min-w-[3ch] border-0 bg-transparent p-0 text-center text-5xl font-semibold tracking-[-0.025em] tabular-nums shadow-none focus-visible:ring-0 md:text-5xl [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={text.increase}
              disabled={accounts >= largest}
              onClick={() => {
                settle(accounts + 1);
              }}
            >
              <PlusIcon aria-hidden />
            </Button>
          </div>
        </div>

        <div className="w-full">
          <Slider
            value={position}
            min={0}
            max={steps}
            step={1}
            largeStep={50}
            // The count itself: past the slider's end, the thumb rests
            // there, but the count is what was typed.
            format={(value) =>
              fill(text.valueText, {
                count: count(
                  value >= steps
                    ? Math.max(accounts, accountsAt(segments, value))
                    : accountsAt(segments, value)
                ),
              })
            }
            onValueChange={(value: number) => {
              setDragging(true);
              setAccounts(accountsAt(segments, value));
            }}
            onValueCommit={() => {
              setDragging(false);
            }}
          >
            <SliderControl className="group/pricer relative flex h-16 w-full cursor-pointer touch-none items-end pb-3 select-none">
              <SliderTrack
                className="bg-border relative h-1.5 w-full rounded-full"
                style={{ "--filled": percent }}
              >
                {/* The fill: the mark's colours across the whole track,
                    blue to lavender to yellow, uncovered up to the count,
                    so its tip's colour says how far it has come. It glides
                    to a count typed, stepped or keyed, and follows the
                    pointer at once while it drags. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 rounded-full bg-[linear-gradient(90deg,var(--brand),var(--lavender)_70%,var(--sun))] [clip-path:inset(0_calc(100%-var(--filled))_0_0_round_999px)]",
                    !dragging &&
                      "transition-[clip-path] duration-300 ease-out motion-reduce:transition-none"
                  )}
                />
                {/* Where each band after the first begins (3, 11, 101 on
                    the rate card): a little block of pixels on the track,
                    in the mark's colours once passed, grey before. */}
                {segments.slice(1).map((segment) => {
                  const passed = position >= segment.start;

                  return (
                    <span
                      key={segment.start}
                      aria-hidden="true"
                      className="bg-background absolute top-1/2 left-(--stop) grid -translate-x-1/2 -translate-y-1/2 grid-cols-2 gap-px p-px"
                      style={{ "--stop": `${(segment.start / steps) * 100}%` }}
                    >
                      {stopTones.map((tone, index) => (
                        <span
                          // The four pixels never move.
                          key={tone + String(index)}
                          className={cn(
                            "size-[5px] transition-colors duration-300 motion-reduce:transition-none",
                            passed ? tone : "bg-border"
                          )}
                        />
                      ))}
                    </span>
                  );
                })}
                <SliderThumb
                  aria-label={text.label}
                  // The track's steps are finer than an account at the low
                  // end: keys move a whole account, or ten, before the
                  // slider's own handling (Home and End are its own).
                  onKeyDownCapture={(event: React.KeyboardEvent) => {
                    const change = keySteps.get(event.key);

                    if (change !== undefined) {
                      event.preventDefault();
                      event.stopPropagation();
                      setAccounts((current) =>
                        Math.min(largest, Math.max(0, current + change))
                      );
                    }
                  }}
                  className={cn(
                    "bg-background border-brand has-[:focus-visible]:outline-ring/50 size-5 rounded-[2px] border-[3px] shadow-md outline-none group-hover/pricer:scale-110 active:scale-125 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 motion-reduce:transition-none",
                    dragging
                      ? "transition-[scale]"
                      : "transition-[left,scale] duration-300 ease-out"
                  )}
                >
                  {/* Where a band change throws its pixels from. */}
                  <span
                    ref={burst}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-1/2"
                  />
                  {/* The count and its band's price, riding above. */}
                  <span
                    aria-hidden="true"
                    className="bg-foreground text-background pointer-events-none absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] whitespace-nowrap tabular-nums shadow-sm after:absolute after:top-full after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rotate-45 after:bg-inherit"
                  >
                    {fill(text.valueText, { count: count(accounts) })}
                    <span className="text-background/60">·</span>
                    <span
                      key={bandIndex}
                      className="animate-in fade-in zoom-in-90 duration-300 motion-reduce:animate-none"
                    >
                      {band === undefined || band.monthly === 0
                        ? text.free
                        : fill(text.perAccount, {
                            price: dollars(band.monthly),
                          })}
                    </span>
                  </span>
                </SliderThumb>
              </SliderTrack>
            </SliderControl>
          </Slider>

          <ol
            className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:relative sm:block sm:h-11"
            aria-hidden="true"
          >
            {segments.map((segment, index) => (
              <li
                key={segment.start}
                className={cn(
                  "flex flex-col gap-0.5 rounded-sm font-mono text-xs tabular-nums transition-colors duration-300 sm:absolute sm:top-0 sm:left-(--stop) sm:-ms-1.5 sm:px-1.5 sm:py-1",
                  index === bandIndex
                    ? "text-foreground bg-brand-tint"
                    : "text-muted-foreground"
                )}
                style={{ "--stop": `${(segment.start / steps) * 100}%` }}
              >
                <span>
                  {segment.band.upTo === null
                    ? fill(text.last, { from: count(segment.first) })
                    : fill(text.range, {
                        from: count(segment.first),
                        to: count(segment.to),
                      })}
                </span>
                <span className="opacity-80">
                  {segment.band.monthly === 0
                    ? text.free
                    : fill(text.perAccount, {
                        price: dollars(segment.band.monthly),
                      })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* The plans' cells share four rows (head, price, button, list),
          so each part lines up with its neighbours'. */}
      <div className="grid lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_1fr] lg:gap-y-6">
        <div className="flex flex-col gap-6 border-b p-6 sm:p-8 lg:row-span-4 lg:grid lg:grid-rows-subgrid lg:border-e lg:border-b-0">
          <div>
            <h3 className="text-[15px] font-semibold">{text.cloud.title}</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {text.cloud.line}
            </p>
          </div>
          <div>
            {/* The figures count to their new value as the count moves;
                a screen reader hears only where they land. */}
            <div aria-hidden="true">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[40px] leading-none font-semibold tracking-[-0.025em] tabular-nums">
                  {total === 0 ? text.free : dollars(Math.round(shownTotal))}
                </span>
                {total === 0 ? null : (
                  <span className="text-muted-foreground text-sm">
                    {text.perMonth} · {text.excluded}
                  </span>
                )}
              </p>
              {total === 0 ? null : (
                <p className="text-muted-foreground mt-2 text-sm tabular-nums">
                  {totals(Math.round(shownTotal))}
                </p>
              )}
            </div>
            <p className="sr-only" aria-live="polite">
              {total === 0
                ? text.free
                : `${dollars(total)} ${text.perMonth} ${text.excluded}. ${totals(total)}`}
            </p>
          </div>
          {/* Four rows in each plan's cell, on the row's subgrid: a missing
              part keeps its row, so the parts line up across the cells. */}
          {cta === undefined ? (
            <span />
          ) : (
            <a href={cta.href} className={cn(buttonVariants(), "w-fit")}>
              {cta.label}
            </a>
          )}
          {cloudItems === undefined ? (
            <span />
          ) : (
            <ul className="text-muted-foreground flex flex-col gap-1.5 border-t pt-5 text-sm">
              {cloudItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="bg-brand mt-[7px] size-[5px] shrink-0"
                  />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};

export { AccountPricer };

export type { AccountPricerProps, AccountPricerText };
