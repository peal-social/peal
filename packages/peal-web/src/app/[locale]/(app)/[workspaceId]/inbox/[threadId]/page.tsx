import { ArrowLeftIcon } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "peal-ui/components/button";

import { ThreadScreen } from "#components/inbox/thread-screen.tsx";
import { SplitDetail } from "#components/shell/frame-view.tsx";
import { Link } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { inboxStateOfParams, withInboxQuery } from "#inbox/inbox-query.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// One thread of the inbox: the comments under a post on one channel, for
// members who may read them (engagement:read). Answering and moderating
// take engagement:reply; a private reply, engagement:message.
const InboxThreadPage = async ({
  params,
  searchParams,
}: PageProps<"/[locale]/[workspaceId]/inbox/[threadId]">) => {
  const { locale, threadId, workspaceId } = await params;
  const query = await searchParams;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);
  const may = new Set(membership.permissions);

  if (!may.has("engagement:read")) {
    notFound();
  }

  const t = await getTranslations("Inbox");

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
      <ThreadScreen
        mayMessage={may.has("engagement:message")}
        mayReply={may.has("engagement:reply")}
        threadId={threadId}
        workspaceId={membership.id}
      />
    </SplitDetail>
  );
};

export const generateMetadata = workspacePageTitle("comment");

export default InboxThreadPage;
