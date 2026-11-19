import { Option, Schema } from "effect";
import { ArrowLeftIcon } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "peal-ui/components/button";

import { currentUser } from "#auth/session.ts";
import { MessageScreen } from "#components/inbox/message-screen.tsx";
import { SplitDetail } from "#components/shell/frame-view.tsx";
import { Link } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { inboxStateOfParams, withInboxQuery } from "#inbox/inbox-query.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
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

  const query = await searchParams;

  const cursor = Schema.decodeUnknownOption(QuerySchema)(query).pipe(
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

  // On a phone, back to the list as it was beside the item.
  const back = withInboxQuery(
    workspacePath(membership.slug, "/inbox"),
    inboxStateOfParams(query)
  );

  return (
    <SplitDetail
      back={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("thread.back")}
          render={<Link href={back} />}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
      }
      title={t("thread.pageName")}
    >
      <MessageScreen
        byHand={byHand}
        conversationId={conversationId}
        cursor={cursor}
        mayAnswer={may.has("engagement:message")}
        workspaceId={membership.id}
      />
    </SplitDetail>
  );
};

export const generateMetadata = workspacePageTitle("message");

export default InboxConversationPage;
