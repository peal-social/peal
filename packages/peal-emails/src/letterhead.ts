import type { EmailAssetName } from "./assets.ts";

/** What every email of one server carries, whoever reads it. */
export interface Letterhead {
  /** Where the server serves `emailAssets`, without a slash at the end. */
  readonly assetsUrl: string;
  /** Who sends, as the operator states it, on one line; none by default. */
  readonly identity: string | null;
}

/** Where a picture is: the same address for every reader. */
export const assetUrl = (
  { assetsUrl }: Letterhead,
  name: EmailAssetName
): string => `${assetsUrl}/${name}`;
