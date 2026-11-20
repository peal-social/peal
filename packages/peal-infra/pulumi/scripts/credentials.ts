// What Pulumi needs before it runs, kept in Proton Pass as the fields of one
// item, named like the variables (README.md, "State and credentials").
import type { Option } from "effect";
import { Schema } from "effect";

/** The Proton Pass vault, unless `PEAL_PASS_VAULT` names another. */
export const defaultPassVault = "Peal";

/** The item whose fields are the credentials. */
export const passItem = "Pulumi";

export const credentialNames = [
  "CLOUDFLARE_API_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "PULUMI_CONFIG_PASSPHRASE",
] as const;

export type CredentialName = (typeof credentialNames)[number];

// None when the field holds nothing: the caller says so without quoting
// what `pass-cli` answered.
export const credentialFrom = (text: string): Option.Option<string> =>
  Schema.decodeUnknownOption(Schema.NonEmptyString)(text.trim());
