"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  maxImageProviderAddressLength,
  maxImageProviderKeyLength,
} from "peal-contract";
import type { AiProviderConnection } from "peal-contract";
import type { AiProviderId } from "peal-contract/ai-providers";
import { Alert, AlertTitle } from "peal-ui/components/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "peal-ui/components/alert-dialog";
import { Badge } from "peal-ui/components/badge";
import { Button } from "peal-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "peal-ui/components/dialog";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";
import { useId } from "react";
import type { ReactNode } from "react";

import {
  isOwnAddress,
  isSavable,
  keyNeeded,
  hasFixedAddress,
  isSandboxAddress,
  providerChosen,
  sandboxAddressOf,
  sandboxChosen,
  typesItsAddress,
} from "#assistant/connections.ts";
import type {
  ConnectionDraft,
  ConnectionErrorKey,
  ConnectionTestKey,
} from "#assistant/connections.ts";
import { hostOf } from "#assistant/host.ts";

import {
  ProviderPicker,
  ProviderTile,
  useProviderName,
} from "./provider-fields.tsx";

/** Where the last test of the provider stands. */
export type TestState =
  | { readonly _tag: "failed"; readonly key: ConnectionTestKey }
  | { readonly _tag: "idle" }
  | { readonly _tag: "passed" };

/**
 * A connected provider's row (DESIGN.md, "Settings"): its mark, its name,
 * the host it is reached at when it is not its own, and that its key is
 * saved; **Edit** opens its form in a dialog, which closes on its own once
 * the provider is saved or removed, as the page then reads it again.
 */
export const ConnectionRowView = ({
  children,
  connection,
}: {
  /** The provider's form, in the dialog. */
  readonly children: ReactNode;
  readonly connection: AiProviderConnection;
}) => {
  const t = useTranslations("Assistant.connections");
  const providers = useTranslations("Assistant.providers");
  const nameOf = useProviderName();
  const labelId = useId();
  const editId = useId();
  const name = nameOf(connection.provider);
  const own = isOwnAddress(connection.provider, connection.baseUrl);
  const sandbox = isSandboxAddress(connection.provider, connection.baseUrl);

  const where = (): string => {
    if (sandbox) {
      return t("atSandbox");
    }

    return own
      ? t("ownAddress")
      : t("at", { host: hostOf(connection.baseUrl) });
  };

  return (
    <SettingsRow>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProviderTile provider={connection.provider} />
        <SettingsRowText>
          <span className="flex items-center gap-2">
            <SettingsRowLabel id={labelId}>{name}</SettingsRowLabel>
            <Badge
              variant={connection.keyUnreadable ? "destructive" : "outline"}
            >
              {connection.keyUnreadable
                ? t("keyUnreadableBadge")
                : t("keySaved")}
            </Badge>
          </span>
          <SettingsRowDescription>{where()}</SettingsRowDescription>
        </SettingsRowText>
      </div>
      <SettingsRowControl>
        <Dialog>
          {/* Named with its provider ("Edit Anthropic"): every row has one. */}
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                id={editId}
                aria-labelledby={`${editId} ${labelId}`}
              />
            }
          >
            {providers("edit")}
          </DialogTrigger>
          <DialogContent closeLabel={providers("close")}>
            <DialogHeader>
              <DialogTitle>{name}</DialogTitle>
              <DialogDescription>{t("dialogDescription")}</DialogDescription>
            </DialogHeader>
            {children}
          </DialogContent>
        </Dialog>
      </SettingsRowControl>
    </SettingsRow>
  );
};

/**
 * **Connect a provider**, at the section header's end: the same form in a
 * dialog, with the provider picker first.
 */
export const ConnectDialogView = ({
  children,
  disabled,
  onOpenChange,
  open,
}: {
  readonly children: ReactNode;
  /** Every provider is connected already. */
  readonly disabled: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) => {
  const t = useTranslations("Assistant.connections");
  const providers = useTranslations("Assistant.providers");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={disabled} />}
      >
        <PlusIcon aria-hidden />
        {t("connect")}
      </DialogTrigger>
      <DialogContent closeLabel={providers("close")}>
        <DialogHeader>
          <DialogTitle>{t("connect")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};

// What the last save, removal or test ended with, read out as it changes.
const Outcome = ({
  error,
  test,
}: {
  readonly error: ConnectionErrorKey | null;
  readonly test: TestState;
}) => {
  const t = useTranslations("Assistant.connections");

  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {error === null ? null : (
        <Alert variant="destructive">
          <AlertTitle>{t(`errors.${error}`)}</AlertTitle>
        </Alert>
      )}
      {test._tag === "failed" ? (
        <Alert variant="destructive">
          <AlertTitle>{t(`testErrors.${test.key}`)}</AlertTitle>
        </Alert>
      ) : null}
      {test._tag === "passed" ? (
        <Alert>
          <AlertTitle>{t("tested")}</AlertTitle>
        </Alert>
      ) : null}
    </div>
  );
};

// The key: a password field; a saved key shows as saved, never its value.
const KeyField = ({
  busy,
  draft,
  id,
  onChange,
  saved,
}: {
  readonly busy: boolean;
  readonly draft: ConnectionDraft;
  readonly id: string;
  readonly onChange: (draft: ConnectionDraft) => void;
  readonly saved: AiProviderConnection | null;
}) => {
  const t = useTranslations("Assistant.connections");
  const needed = keyNeeded(draft, saved);
  const kept = saved !== null && needed === null;

  // Once a key is typed, the reason to type one is answered.
  const keyHint =
    needed === null || needed === "noKey" || draft.apiKey.trim() !== ""
      ? null
      : t(needed);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t("apiKey")}</Label>
      <Input
        id={id}
        name="apiKey"
        type="password"
        autoComplete="off"
        spellCheck={false}
        required={needed !== null}
        maxLength={maxImageProviderKeyLength}
        value={draft.apiKey}
        placeholder={kept ? t("apiKeySaved") : undefined}
        disabled={busy}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          onChange({ ...draft, apiKey: event.target.value });
        }}
      />
      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        {kept ? t("apiKeySet") : t("apiKeyHint")}
      </p>
      {keyHint === null ? null : (
        <p className="text-destructive text-xs">{keyHint}</p>
      )}
    </div>
  );
};

// Removing, which asks first, and testing, for a saved provider, at the
// start of the form's foot, and Save at its end.
const FormActions = ({
  busy,
  name,
  onRemove,
  onTest,
  removing,
  savable,
  saved,
  saving,
  testHintId,
  testable,
  testing,
}: {
  readonly busy: boolean;
  readonly name: string;
  readonly onRemove: () => void;
  readonly onTest: () => void;
  readonly removing: boolean;
  readonly savable: boolean;
  readonly saved: boolean;
  readonly saving: boolean;
  readonly testHintId: string;
  readonly testable: boolean;
  readonly testing: boolean;
}) => {
  const t = useTranslations("Assistant.connections");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {saved ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="ghost" disabled={busy} />}
            >
              {removing ? t("removing") : t("remove")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("removeTitle", { name })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("removeDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onRemove}>
                  {t("removeConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        {saved && testable ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            aria-describedby={testHintId}
            onClick={onTest}
          >
            {testing ? t("testing") : t("test")}
          </Button>
        ) : null}
      </div>
      <Button type="submit" disabled={busy || !savable}>
        {saving ? t("saving") : t("save")}
      </Button>
    </div>
  );
};

export interface ConnectionFormViewProps {
  readonly draft: ConnectionDraft;
  /** Why the last save or removal failed, if it did. */
  readonly error: ConnectionErrorKey | null;
  readonly onChange: (draft: ConnectionDraft) => void;
  readonly onRemove: () => void;
  readonly onSave: () => void;
  readonly onTest: () => void;
  /**
   * The providers the picker offers, for a new connection; null to edit
   * a saved one, whose provider stays.
   */
  readonly options: readonly AiProviderId[] | null;
  readonly removing: boolean;
  /** The connection the workspace has now, or null. */
  readonly saved: AiProviderConnection | null;
  readonly saving: boolean;
  readonly test: TestState;
  /** Whether Test is offered: a saved provider Peal knows a model of. */
  readonly testable: boolean;
  readonly testing: boolean;
}

/**
 * A provider's form, in its dialog: the provider (a new one only), the key
 * (a password field; a saved key shows as saved, never its value, and is
 * kept unless typed again; one that can no longer be read, or an address
 * moved, asks for it again), and the address, which a provider of the
 * catalogue fills in and keeps under **Advanced**. Under them, in small
 * muted text, where requests go and that the key is kept encrypted.
 * **Test** sends a saved provider one request for text; removing asks
 * first.
 */
export const ConnectionFormView = ({
  draft,
  error,
  onChange,
  onRemove,
  onSave,
  onTest,
  options,
  removing,
  saved,
  saving,
  test,
  testable,
  testing,
}: ConnectionFormViewProps) => {
  const t = useTranslations("Assistant.connections");
  const providers = useTranslations("Assistant.providers");
  const nameOf = useProviderName();
  const ids = useId();
  const busy = saving || removing || testing;
  const savable = isSavable(draft, saved);
  const name = nameOf(draft.provider);

  const address = (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${ids}-base-url`}>{t("baseUrl")}</Label>
      <Input
        id={`${ids}-base-url`}
        name="baseUrl"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={maxImageProviderAddressLength}
        value={draft.baseUrl}
        disabled={busy}
        aria-describedby={`${ids}-base-url-hint`}
        onChange={(event) => {
          onChange({ ...draft, baseUrl: event.target.value });
        }}
      />
      <p id={`${ids}-base-url-hint`} className="text-muted-foreground text-xs">
        {typesItsAddress(draft.provider)
          ? t("baseUrlOtherHint")
          : t("baseUrlHint")}
      </p>
    </div>
  );

  const inSandbox = isSandboxAddress(draft.provider, draft.baseUrl);

  // A service with a sandbox (Shotstack) offers it instead of an address:
  // production by default, the sandbox under Advanced.
  const environment =
    sandboxAddressOf(draft.provider) === null ? null : (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-environment`}>{t("environment")}</Label>
        <Select
          value={inSandbox ? "sandbox" : "production"}
          disabled={busy}
          onValueChange={(value: string | null) => {
            onChange(sandboxChosen(draft, value === "sandbox"));
          }}
        >
          <SelectTrigger
            id={`${ids}-environment`}
            className="w-full"
            aria-describedby={`${ids}-environment-hint`}
          >
            <SelectValue>
              {inSandbox ? t("sandbox") : t("production")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="production" label={t("production")}>
              {t("production")}
            </SelectItem>
            <SelectItem value="sandbox" label={t("sandbox")}>
              {t("sandbox")}
            </SelectItem>
          </SelectContent>
        </Select>
        <p
          id={`${ids}-environment-hint`}
          className="text-muted-foreground text-xs"
        >
          {inSandbox ? t("sandboxHint") : t("productionHint")}
        </p>
      </div>
    );

  // The address: the environment for a service with a sandbox, none for
  // another provider reached at its own alone, in the open for another
  // provider, under Advanced for the others.
  const addressSection = (
    advanced: (field: ReactNode) => ReactNode
  ): ReactNode => {
    if (environment !== null) {
      return advanced(environment);
    }

    if (hasFixedAddress(draft.provider)) {
      return null;
    }

    return typesItsAddress(draft.provider) ? address : advanced(address);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (savable && !busy) {
          onSave();
        }
      }}
    >
      {options === null ? null : (
        <ProviderPicker
          id={`${ids}-provider`}
          disabled={busy}
          options={options}
          value={draft.provider}
          onChoose={(provider) => {
            onChange(providerChosen(draft, provider));
          }}
        />
      )}
      <KeyField
        busy={busy}
        draft={draft}
        id={`${ids}-key`}
        saved={saved}
        onChange={onChange}
      />
      {addressSection((field) => (
        <details>
          <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-sm select-none">
            {providers("advanced")}
          </summary>
          <div className="pt-3">{field}</div>
        </details>
      ))}
      <p className="text-muted-foreground text-xs">{t("notice")}</p>
      <Outcome error={error} test={test} />
      {saved !== null && testable ? (
        <p id={`${ids}-test-hint`} className="sr-only">
          {t("testHint")}
        </p>
      ) : null}
      <FormActions
        busy={busy}
        name={name}
        removing={removing}
        savable={savable}
        saved={saved !== null}
        saving={saving}
        testHintId={`${ids}-test-hint`}
        testable={testable}
        testing={testing}
        onRemove={onRemove}
        onTest={onTest}
      />
    </form>
  );
};
