import type { CORSRule } from "@aws-sdk/client-s3";

// The admin uploads media with a presigned PUT straight from the browser to
// the bucket, signed with the file's Content-Type (EmDash's s3 storage), so
// the bucket must answer that request's preflight. Media is read back
// through the blog's server, so reads need no rule.

/** The id of the rule the blog manages, so other rules are left alone. */
export const uploadRuleId = "peal-blog-uploads";

export const uploadRule = (origins: readonly string[]): CORSRule => ({
  AllowedHeaders: ["content-type"],
  AllowedMethods: ["PUT"],
  AllowedOrigins: [...new Set(origins)].toSorted(),
  ID: uploadRuleId,
  MaxAgeSeconds: 3600,
});

// A list of a rule as stores compare it: without case or order.
const listOf = (values: readonly string[] | undefined): string =>
  [...(values ?? [])]
    .map((value) => value.toLowerCase())
    .toSorted()
    .join(" ");

const sameRule = (left: CORSRule, right: CORSRule): boolean =>
  left.ID === right.ID &&
  left.MaxAgeSeconds === right.MaxAgeSeconds &&
  listOf(left.AllowedOrigins) === listOf(right.AllowedOrigins) &&
  listOf(left.AllowedMethods) === listOf(right.AllowedMethods) &&
  listOf(left.AllowedHeaders) === listOf(right.AllowedHeaders) &&
  listOf(left.ExposeHeaders) === listOf(right.ExposeHeaders);

/**
 * The bucket's rules with the blog's in place of any earlier version of it,
 * and whether that changes anything. Rules with another id stay.
 */
export const withUploadRule = (
  existing: readonly CORSRule[],
  rule: CORSRule
) => {
  const others = existing.filter((current) => current.ID !== rule.ID);
  const current = existing.filter((candidate) => candidate.ID === rule.ID);

  const changed =
    current.length !== 1 || current.every((found) => !sameRule(found, rule));

  return { changed, rules: [...others, rule] };
};
