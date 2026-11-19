import { Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { AgendaScreen } from "#components/overview/agenda-screen.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";

// What goes out across the signed-in person's workspaces, which the list
// names from GET /api/me: those where they may read posts. A list, not
// the week's grid: nothing is moved across workspaces. Anyone signed out
// is sent to sign in.
const AgendaPage = async ({ params }: PageProps<"/[locale]/agenda">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/sign-in", locale });
  }

  const workspaces = me.value.workspaces
    .filter(({ permissions }) => permissions.includes("post:read"))
    .map(({ id, name }) => ({ id, name }));

  return <AgendaScreen workspaces={workspaces} />;
};

export default AgendaPage;
