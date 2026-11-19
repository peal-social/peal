import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ReviewScreen } from "#components/inbox/review-screen.tsx";
import { PageTitle } from "#components/shell/frame-view.tsx";
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
    <div className="flex flex-col gap-8">
      <PageTitle>{t("thread.pageName")}</PageTitle>
      <Link
        href={workspacePath(membership.slug, "/inbox")}
        className="text-muted-foreground self-start text-sm underline-offset-4 hover:underline"
      >
        {t("thread.back")}
      </Link>
      <ReviewScreen
        mayReply={may.has("engagement:reply")}
        threadId={threadId}
        workspaceId={membership.id}
      />
    </div>
  );
};

export default InboxReviewsPage;
