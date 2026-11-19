import { ArrowLeftIcon } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "peal-ui/components/button";

import { ReviewScreen } from "#components/inbox/review-screen.tsx";
import { SplitDetail } from "#components/shell/frame-view.tsx";
import { Link } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// One location's reviews, for members who may read them
// (engagement:read). Answering takes engagement:reply.
const InboxReviewsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/inbox/reviews/[threadId]">) => {
  const { locale, threadId, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);
  const may = new Set(membership.permissions);

  if (!may.has("engagement:read")) {
    notFound();
  }

  const t = await getTranslations("InboxReviews");

  return (
    <SplitDetail
      back={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("thread.back")}
          render={<Link href={workspacePath(membership.slug, "/inbox")} />}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
      }
      title={t("thread.pageName")}
    >
      <ReviewScreen
        mayReply={may.has("engagement:reply")}
        threadId={threadId}
        workspaceId={membership.id}
      />
    </SplitDetail>
  );
};

export default InboxReviewsPage;
