import { useTranslations } from "next-intl";
import { cn } from "peal-ui/lib/utils";

/**
 * The time zone a screen shows its times or its days in (DESIGN.md,
 * "Lists: filters and display"): one muted 12 px line, the zone's name
 * written with spaces. The zone is the browser's, so the screen renders
 * it once hydrated.
 */
export const TimeZoneLine = ({
  className,
  of,
  timeZone,
}: {
  readonly className?: string;
  /** What follows the zone: the times of day, or the days themselves. */
  readonly of: "days" | "times";
  readonly timeZone: string;
}) => {
  const t = useTranslations("Lists");

  return (
    <p className={cn("text-muted-foreground text-xs", className)}>
      {t("timeZoneLine", { of, zone: timeZone.replaceAll("_", " ") })}
    </p>
  );
};
