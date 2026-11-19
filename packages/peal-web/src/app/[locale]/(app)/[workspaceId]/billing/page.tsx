import { Effect, Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { termsUrlConfig } from "#billing/terms.ts";
import { BillingScreen } from "#components/billing/billing-screen.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// A workspace's billing, for members with billing:read: its plan, what it
// uses of it, and, for those with billing:manage, orders, checkout, the
// billing portal, cancelling and withdrawing. Stripe sends the browser back
// here with ?checkout=done.
const BillingPage = async ({
  params,
  searchParams,
}: PageProps<"/[locale]/[workspaceId]/billing">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/sign-in", locale });
  }

  const workspace = workspaceAt(me.value.workspaces, workspaceId);

  if (
    workspace === undefined ||
    !workspace.permissions.includes("billing:read")
  ) {
    notFound();
  }

  const { checkout } = await searchParams;
  const termsUrl = await Effect.runPromise(termsUrlConfig);

  return (
    <BillingScreen
      workspaceId={workspace.id}
      canManage={workspace.permissions.includes("billing:manage")}
      checkedOut={checkout === "done"}
      termsUrl={termsUrl}
      userId={me.value.user.id}
    />
  );
};

export const generateMetadata = workspacePageTitle("billing");

export default BillingPage;
