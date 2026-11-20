import path from "node:path";

// Runs the Pulumi CLI in one of this package's projects, with the
// credentials it needs read from Proton Pass through `pass-cli` (README.md,
// "State and credentials"):
//
//   bun scripts/pulumi.ts <account|environment> <pulumi arguments…>
//
// Each variable already set wins, as in CI, and Proton Pass is read only for
// the missing ones, once `pass-cli login` signed it in. They reach Pulumi in
// its environment alone, never a file. Nothing here prints a secret.
import { Option } from "effect";

import {
  credentialFrom,
  credentialNames,
  defaultPassVault,
  passItem,
} from "./credentials.ts";
import type { CredentialName } from "./credentials.ts";

const [project, ...args] = process.argv.slice(2);

if (project !== "account" && project !== "environment") {
  console.error(
    "Usage: bun scripts/pulumi.ts <account|environment> <pulumi arguments…>"
  );
  process.exit(2);
}

const vault = process.env["PEAL_PASS_VAULT"] ?? defaultPassVault;

const missing = credentialNames.filter(
  (name) => process.env[name] === undefined
);

// One field of the item, or none when `pass-cli` gives nothing usable.
const fieldOf = (name: CredentialName): Option.Option<string> => {
  const found = Bun.spawnSync(
    [
      "pass-cli",
      "item",
      "view",
      "--vault-name",
      vault,
      "--item-title",
      passItem,
      "--field",
      name,
    ],
    { stderr: "ignore", stdin: "ignore", stdout: "pipe" }
  );

  return found.exitCode === 0
    ? credentialFrom(found.stdout.toString())
    : Option.none();
};

const env: Record<string, string> = {};

for (const name of missing) {
  const value = fieldOf(name);

  if (Option.isNone(value)) {
    console.error(
      `No field ${name} in "${passItem}" of the Proton Pass vault "${vault}", or pass-cli is not signed in (pass-cli login; README.md).`
    );
    process.exit(1);
  }

  env[name] = value.value;
}

const run = Bun.spawn(["pulumi", ...args], {
  cwd: path.join(import.meta.dir, "..", project),
  env: { ...process.env, ...env },
  stdio: ["inherit", "inherit", "inherit"],
});

process.exit(await run.exited);
