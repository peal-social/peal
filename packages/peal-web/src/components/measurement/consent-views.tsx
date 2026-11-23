import { useTranslations } from "next-intl";
import type { BrowserAnalyticsChoice } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "peal-ui/components/card";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";

interface ChoiceButtonsProps {
  readonly onChoose: (choice: BrowserAnalyticsChoice) => void;
  /** The choice being saved, if one is. */
  readonly pending: BrowserAnalyticsChoice | null;
}

// The two answers, the same variant and size side by side, so refusing is
// as easy as allowing (DESIGN.md, "Consent").
const ChoiceButtons = ({ onChoose, pending }: ChoiceButtonsProps) => {
  const t = useTranslations("Measurement.card");
  const busy = pending !== null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={busy}
        focusableWhenDisabled
        onClick={() => {
          onChoose("granted");
        }}
      >
        {t("allow")}
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        focusableWhenDisabled
        onClick={() => {
          onChoose("refused");
        }}
      >
        {t("refuse")}
      </Button>
    </div>
  );
};

const Failure = ({ text }: { readonly text: string }) => (
  <p role="alert" className="text-destructive text-sm">
    {text}
  </p>
);

interface ConsentCardViewProps extends ChoiceButtonsProps {
  readonly failed: boolean;
  /** The operator's privacy policy, left out when it has none. */
  readonly privacyUrl: string | null;
}

/**
 * The question the web app asks before it links what someone does to
 * their account or records their sessions: a card in the page's content,
 * with its two answers.
 */
export const ConsentCardView = ({
  failed,
  onChoose,
  pending,
  privacyUrl,
}: ConsentCardViewProps) => {
  const t = useTranslations("Measurement.card");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
        <CardDescription>{t("text")}</CardDescription>
      </CardHeader>
      {privacyUrl === null ? null : (
        <CardContent>
          <a href={privacyUrl} className="text-sm underline underline-offset-4">
            {t("privacy")}
          </a>
        </CardContent>
      )}
      <CardFooter>
        <div className="flex flex-col items-start gap-3">
          <ChoiceButtons onChoose={onChoose} pending={pending} />
          {failed ? <Failure text={t("failed")} /> : null}
        </div>
      </CardFooter>
    </Card>
  );
};

interface ConsentSettingViewProps extends ChoiceButtonsProps {
  readonly consent: "granted" | "refused" | "undecided";
  /** When the choice was made, none while undecided. */
  readonly decidedAt: Date | null;
  readonly failed: boolean;
}

/** The account page's row: the choice as it stands, and the two answers. */
export const ConsentSettingView = ({
  consent,
  decidedAt,
  failed,
  onChoose,
  pending,
}: ConsentSettingViewProps) => {
  const t = useTranslations("Measurement.setting");

  const standing =
    consent === "undecided" || decidedAt === null
      ? t("undecided")
      : t(consent === "granted" ? "allowed" : "refused", { date: decidedAt });

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel>{t("title")}</SettingsRowLabel>
        <SettingsRowDescription>{t("description")}</SettingsRowDescription>
        <SettingsRowDescription>{standing}</SettingsRowDescription>
        {failed ? <Failure text={t("failed")} /> : null}
      </SettingsRowText>
      <SettingsRowControl>
        <ChoiceButtons onChoose={onChoose} pending={pending} />
      </SettingsRowControl>
    </SettingsRow>
  );
};
