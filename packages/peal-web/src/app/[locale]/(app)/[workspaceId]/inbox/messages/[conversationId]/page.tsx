import { Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { MessageScreen } from "#components/inbox/message-screen.tsx";
import { PageTitle } from "#components/shell/frame-view.tsx";
import { Link } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// The page's query: `cursor` names a page of older messages.
const QuerySchema = Schema.Struct({ cursor: Schema.optional(Schema.String) });

// One conversation, for members who may read direct messages
// (engagement:readMessages). Answering takes engagement:message.
const InboxConversationPage = async ({
  params,
  searchParams,
}: PageProps<"/[locale]/[workspaceId]/inbox/messages/[conversationId]">) => {
  const { conversationId, locale, workspaceId } = await params;

  const cursor = Schema.decodeUnknownOption(QuerySchema)(
    await searchParams
  ).pipe(
    Option.flatMapNullishOr(({ cursor: named }) => named),
    Option.getOrElse(() => "")
  );

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);
  const may = new Set(membership.permissions);

  if (!may.has("engagement:readMessages")) {
    notFound();
  }

  const t = await getTranslations("InboxMessages");

  // Staff acting as the member get none of a person's 7 days.
  const byHand = Option.exists(
    await currentUser(),
    ({ impersonatedBy }) => impersonatedBy === null
  );

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>{t("thread.pageName")}</PageTitle>
      <Link
        href={workspacePath(membership.slug, "/inbox")}
        className="text-muted-foreground self-start text-sm underline-offset-4 hover:underline"
      >
        {t("thread.back")}
      </Link>
      <MessageScreen
        byHand={byHand}
        conversationId={conversationId}
        cursor={cursor}
        mayAnswer={may.has("engagement:message")}
        workspaceId={membership.id}
      />
    </div>
  );
};

export default InboxConversationPage;
