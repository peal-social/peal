import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Permission } from "peal-contract";

import { PostImport } from "#components/posts/post-import.tsx";
import { Link } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// What an import asks of the member.
const needed: readonly Permission[] = [
  "post:schedule",
  "post:read",
  "channel:read",
];

// Imports posts from a CSV file through `posts.import`, which needs
// post:schedule, post:read and channel:read: anyone else finds no page.
const PostImportPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/posts/import">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (
    !needed.every((permission) => membership.permissions.includes(permission))
  ) {
    notFound();
  }

  const t = await getTranslations("Posts.Import");

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={workspacePath(membership.slug, "/posts")}
        className="text-muted-foreground self-start text-sm underline-offset-4 hover:underline"
      >
        {t("allPosts")}
      </Link>
      <PostImport workspaceId={membership.id} />
    </div>
  );
};

export default PostImportPage;
