import type { DateTime, Effect } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";

/** A file as the site keeps it: its id there, and its address. */
export interface SiteFile {
  readonly id: number;
  readonly sourceUrl: string;
  /** The site dropped it as the featured image, even sent again. */
  readonly featuredRefused?: boolean;
}

/** One attempt's call to a website, as the journal that owns it began it. */
export interface SiteCallRequest {
  /** When the attempt's call started, as the journal recorded it. */
  readonly startedAt: DateTime.Utc;
}

/**
 * What a change of a post already on the site needs of the journal that
 * owns it: the files the site took, kept across attempts and changes so
 * none is sent twice, and the posts recorded on the channel.
 */
export interface SiteFileJournal {
  /** The files sent to the site already, by the library's id. */
  readonly filesSent: Effect.Effect<
    ReadonlyMap<MediaAssetId, SiteFile>,
    DatabaseError
  >;
  /** Records a file the site took. */
  readonly fileSent: (
    mediaId: MediaAssetId,
    file: SiteFile
  ) => Effect.Effect<void, DatabaseError>;
  /** Forgets a file the site no longer has: it is sent again. */
  readonly forgetFile: (
    mediaId: MediaAssetId
  ) => Effect.Effect<void, DatabaseError>;
  /**
   * Records that the site drops the file as the featured image, even sent
   * again: it is not offered as one any more.
   */
  readonly featuredRefused: (
    mediaId: MediaAssetId
  ) => Effect.Effect<void, DatabaseError>;
  /**
   * Which of these ids on the site any post or article of the channel,
   * this one's included, is recorded to have made: a search on the site
   * never adopts one.
   */
  readonly recordedOn: (
    platformPostIds: readonly string[]
  ) => Effect.Effect<ReadonlySet<string>, DatabaseError>;
}

/** What an attempt's call needs of the journal that owns it. */
export interface SiteCallJournal extends SiteFileJournal {
  /**
   * Records that the call that makes the post leaves now, and when: the
   * adapter runs it just before that call, and looks for a post changed
   * since then when its answer is lost. A run that stopped before it is
   * made again.
   */
  readonly committing: Effect.Effect<DateTime.Utc, DatabaseError>;
}
