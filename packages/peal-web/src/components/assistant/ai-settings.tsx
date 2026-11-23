"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import type { AiCapabilityModel, AiProviderConnection } from "peal-contract";
import type { AiProviderId } from "peal-contract/ai-providers";
import {
  SettingsCard,
  SettingsCardBody,
  SettingsRow,
  SettingsRowDescription,
} from "peal-ui/components/settings";
import { toast } from "peal-ui/components/toast";
import { useState, useTransition } from "react";

import {
  connectProvider,
  disconnectProvider,
  providersChanged,
  setModel,
  testProvider,
  unsetModel,
  workspaceModels,
  workspaceProviders,
} from "#assistant/atoms.ts";
import {
  changeOf,
  connectionErrorKey,
  draftOf,
  testFailureKey,
  testModelOf,
} from "#assistant/connections.ts";
import type {
  ConnectionErrorKey,
  ConnectionFailure,
  ConnectionTestFailure,
} from "#assistant/connections.ts";
import {
  modelErrorKey,
  providerChoicesFor,
  startingModelOf,
} from "#assistant/models.ts";
import type { ModelFailure } from "#assistant/models.ts";
import { connectable, takesModel } from "#assistant/provider-catalogue.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { SettingsGroup } from "#components/settings/settings-group.tsx";
import {
  SettingsLoadFailed,
  SettingsLoading,
} from "#components/settings/settings-status.tsx";
import { failureOf } from "#posts/outcome.ts";

import {
  ConnectDialogView,
  ConnectionFormView,
  ConnectionRowView,
} from "./connection-views.tsx";
import type { TestState } from "./connection-views.tsx";
import { ModelRowView } from "./model-row-views.tsx";
import type { ModelChoice } from "./model-row-views.tsx";
import { useProviderName } from "./provider-fields.tsx";

const unexpected = (): ConnectionFailure => ({ _tag: "Unexpected" });

const unexpectedTest = (): ConnectionTestFailure => ({ _tag: "Unexpected" });

const unexpectedModel = (): ModelFailure => ({ _tag: "Unexpected" });

const idle: TestState = { _tag: "idle" };

// A provider's form, saved or new; saving or removing reads the providers
// again, which closes its dialog.
const ConnectionForm = ({
  models,
  onSaved,
  options,
  provider,
  saved,
  workspaceId,
}: {
  readonly models: readonly AiCapabilityModel[];
  /** Called once the provider is saved. */
  readonly onSaved?: () => void;
  readonly options: readonly AiProviderId[] | null;
  readonly provider: AiProviderId;
  readonly saved: AiProviderConnection | null;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Assistant.connections");
  const nameOf = useProviderName();
  const save = useAtomSet(connectProvider, { mode: "promiseExit" });
  const remove = useAtomSet(disconnectProvider, { mode: "promiseExit" });
  const check = useAtomSet(testProvider, { mode: "promiseExit" });
  const [draft, setDraft] = useState(() => draftOf(saved, provider));
  const [error, setError] = useState<ConnectionErrorKey | null>(null);
  const [test, setTest] = useState<TestState>(idle);
  const [saving, startSaving] = useTransition();
  const [removing, startRemoving] = useTransition();
  const [testing, startTesting] = useTransition();
  const reactivityKeys = providersChanged(workspaceId);
  const params = { provider: draft.provider, workspaceId };

  return (
    <ConnectionFormView
      draft={draft}
      error={error}
      options={options}
      removing={removing}
      saved={saved}
      saving={saving}
      test={test}
      testable={testModelOf(draft.provider, models) !== null}
      testing={testing}
      onChange={(next) => {
        setDraft(next);
        setError(null);
        setTest(idle);
      }}
      onRemove={() => {
        setError(null);
        setTest(idle);
        startRemoving(async () => {
          const exit = await remove({ params, reactivityKeys });

          if (Exit.isSuccess(exit)) {
            toast.success(t("removed", { name: nameOf(draft.provider) }));

            return;
          }

          setError(
            connectionErrorKey(Option.getOrElse(failureOf(exit), unexpected))
          );
        });
      }}
      onSave={() => {
        setError(null);
        setTest(idle);
        startSaving(async () => {
          const exit = await save({
            params,
            payload: changeOf(draft),
            reactivityKeys,
          });

          if (Exit.isSuccess(exit)) {
            // The key is never kept in the page once saved.
            setDraft(draftOf(exit.value, exit.value.provider));
            toast.success(t("saved", { name: nameOf(draft.provider) }));
            onSaved?.();

            return;
          }

          setError(
            connectionErrorKey(Option.getOrElse(failureOf(exit), unexpected))
          );
        });
      }}
      onTest={() => {
        setError(null);
        setTest(idle);
        startTesting(async () => {
          const exit = await check({ params, payload: {} });

          setTest(
            Exit.isSuccess(exit)
              ? { _tag: "passed" }
              : {
                  _tag: "failed",
                  key: testFailureKey(
                    Option.getOrElse(failureOf(exit), unexpectedTest)
                  ),
                }
          );
        });
      }}
    />
  );
};

// One use's row: a provider chosen with a model the catalogue suggests is
// saved at once; one that suggests none waits for the model typed.
const ModelRow = ({
  chosen,
  connections,
  workspaceId,
}: {
  readonly chosen: AiCapabilityModel;
  readonly connections: readonly AiProviderConnection[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Assistant.models");
  const nameOf = useProviderName();
  const choose = useAtomSet(setModel, { mode: "promiseExit" });
  const leave = useAtomSet(unsetModel, { mode: "promiseExit" });
  const [pending, setPending] = useState<ModelChoice | null>(null);
  const [busy, startBusy] = useTransition();
  const { capability } = chosen;
  const use = t(`uses.${capability}`);
  const params = { capability, workspaceId };
  const reactivityKeys = providersChanged(workspaceId);
  const shown: ModelChoice = pending ?? chosen;

  const failed = (exit: Exit.Exit<unknown, ModelFailure>) => {
    toast.error(
      t(
        `errors.${modelErrorKey(Option.getOrElse(failureOf(exit), unexpectedModel))}`,
        {
          use,
        }
      )
    );
  };

  const saveModel = async (
    provider: AiProviderId,
    model: string | null
  ): Promise<boolean> => {
    const exit = await choose({
      params,
      // A use that takes no model sends none.
      payload: model === null ? { provider } : { model, provider },
      reactivityKeys,
    });

    if (Exit.isSuccess(exit)) {
      setPending(null);
      toast.success(
        model === null
          ? t("savedProvider", { provider: nameOf(provider), use })
          : t("saved", { model, provider: nameOf(provider), use })
      );

      return true;
    }

    failed(exit);

    return false;
  };

  return (
    <ModelRowView
      busy={busy}
      capability={capability}
      chosen={shown}
      providers={providerChoicesFor(capability, connections)}
      serverModel={chosen.serverModel}
      onModel={async (model) =>
        shown.provider === null
          ? await Promise.resolve(false)
          : await saveModel(shown.provider, model)
      }
      onProvider={(provider) => {
        startBusy(async () => {
          if (provider === null) {
            setPending(null);

            const exit = await leave({ params, reactivityKeys });

            if (Exit.isSuccess(exit)) {
              toast.success(
                chosen.serverModel
                  ? t("unsetServer", { use })
                  : t("unsetOff", { use })
              );

              return;
            }

            failed(exit);

            return;
          }

          if (!takesModel(capability)) {
            await saveModel(provider, null);

            return;
          }

          const model = startingModelOf(provider, capability, chosen);

          if (model === null) {
            // Nothing to suggest: the field asks for the model.
            setPending({ model: null, provider });

            return;
          }

          await saveModel(provider, model);
        });
      }}
    />
  );
};

const Loading = ({
  description,
  title,
}: {
  readonly description: string;
  readonly title: string;
}) => (
  <SettingsGroup title={title} description={description}>
    <SettingsCard>
      <SettingsCardBody>
        <SettingsLoading />
      </SettingsCardBody>
    </SettingsCard>
  </SettingsGroup>
);

/**
 * The assistant's settings page, read with the visitor's cookies once it
 * has hydrated, for members with assistant:configure: the providers the
 * workspace connected, each a row, with **Connect a provider** at the
 * section's end; then the model for each use, each a row.
 */
export const AiSettings = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const connections = useTranslations("Assistant.connections");
  const modelsT = useTranslations("Assistant.models");
  const hydrated = useHydrated();
  const providersResult = useAtomValue(workspaceProviders(workspaceId));
  const modelsResult = useAtomValue(workspaceModels(workspaceId));
  const refreshProviders = useAtomRefresh(workspaceProviders(workspaceId));
  const refreshModels = useAtomRefresh(workspaceModels(workspaceId));
  const providersTitle = connections("title");
  const providersDescription = connections("description");
  const modelsTitle = modelsT("title");
  const modelsDescription = modelsT("description");
  const [connecting, setConnecting] = useState(false);

  // A new form after each save, so the dialog opens again empty.
  const [round, setRound] = useState(0);

  const closeConnecting = () => {
    setConnecting(false);
    setRound((done) => done + 1);
  };

  if (
    !hydrated ||
    AsyncResult.isInitial(providersResult) ||
    AsyncResult.isInitial(modelsResult)
  ) {
    return (
      <>
        <Loading title={providersTitle} description={providersDescription} />
        <Loading title={modelsTitle} description={modelsDescription} />
      </>
    );
  }

  if (
    !AsyncResult.isSuccess(providersResult) ||
    !AsyncResult.isSuccess(modelsResult)
  ) {
    return (
      <SettingsGroup title={providersTitle} description={providersDescription}>
        <SettingsCard>
          <SettingsCardBody>
            <SettingsLoadFailed
              onRetry={() => {
                refreshProviders();
                refreshModels();
              }}
            />
          </SettingsCardBody>
        </SettingsCard>
      </SettingsGroup>
    );
  }

  const connected = providersResult.value.providers;
  const { models } = modelsResult.value;
  const offered = connectable(connected.map(({ provider }) => provider));
  const [first] = offered;

  return (
    <>
      <SettingsGroup
        title={providersTitle}
        description={providersDescription}
        actions={
          <ConnectDialogView
            disabled={first === undefined}
            onOpenChange={setConnecting}
            open={connecting}
          >
            {first === undefined ? null : (
              <ConnectionForm
                key={round}
                models={models}
                onSaved={closeConnecting}
                options={offered}
                provider={first}
                saved={null}
                workspaceId={workspaceId}
              />
            )}
          </ConnectDialogView>
        }
      >
        <SettingsCard>
          {connected.length === 0 ? (
            <SettingsRow>
              <SettingsRowDescription>
                {connections("none")}
              </SettingsRowDescription>
            </SettingsRow>
          ) : (
            connected.map((connection) => (
              <ConnectionRowView
                key={`${connection.provider}@${connection.updatedAt.toString()}`}
                connection={connection}
              >
                <ConnectionForm
                  models={models}
                  options={null}
                  provider={connection.provider}
                  saved={connection}
                  workspaceId={workspaceId}
                />
              </ConnectionRowView>
            ))
          )}
        </SettingsCard>
      </SettingsGroup>
      <SettingsGroup title={modelsTitle} description={modelsDescription}>
        <SettingsCard>
          {models.map((chosen) => (
            <ModelRow
              key={`${chosen.capability}@${String(chosen.provider)}@${String(chosen.model)}`}
              chosen={chosen}
              connections={connected}
              workspaceId={workspaceId}
            />
          ))}
        </SettingsCard>
      </SettingsGroup>
    </>
  );
};
