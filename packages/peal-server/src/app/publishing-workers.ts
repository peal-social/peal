import { Layer } from "effect";

import {
  ChannelGateLive,
  GatedFollowUpPublisher,
  GatedLivePostClients,
  GatedPlatformPublisher,
  UnreadComments,
  UnreadMetrics,
} from "#channels/container.ts";
import { FollowUpPublisher } from "#publishing/application/follow-ups/follow-up-publisher.ts";
import { LivePostClients } from "#publishing/application/live-post-clients.ts";
import type { PlatformPublisher } from "#publishing/application/platform-publisher.ts";
import { PublishingWorkersLive } from "#publishing/container.ts";

// What the gates read analytics' counts with (MetricsReader): the readers
// the composition root brings, or none.
type GateReaders<E, R> = Layer.Layer<Layer.Success<typeof UnreadMetrics>, E, R>;

// What the gates read comments, reviews and messages and answer them with:
// engagement's platforms, or none.
type GateEngagement<E, R> = Layer.Layer<
  Layer.Success<typeof UnreadComments>,
  E,
  R
>;

/**
 * Registers the publishing workflows and the channel gates they call the
 * platforms through: the gates publish through `platforms`, read counts
 * for analytics with `readers` (by default, none), comments, reviews and
 * messages for engagement with `engagement` (by default, none), change
 * live posts with `live` and carry follow-ups out with `followUps` (by
 * default, neither). Needs the cluster and what PublishingLive provides,
 * PublicationOutcomes included.
 */
export const publishingWorkers = <
  E,
  R,
  E2 = never,
  R2 = never,
  E3 = never,
  R3 = never,
  E4 = never,
  R4 = never,
  E5 = never,
  R5 = never,
>(
  platforms: Layer.Layer<PlatformPublisher, E, R>,
  readers: GateReaders<E2, R2> = UnreadMetrics,
  engagement: GateEngagement<E3, R3> = UnreadComments,
  live: Layer.Layer<LivePostClients, E4, R4> = LivePostClients.none,
  followUps: Layer.Layer<FollowUpPublisher, E5, R5> = FollowUpPublisher.none
) =>
  PublishingWorkersLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        GatedPlatformPublisher,
        GatedLivePostClients,
        GatedFollowUpPublisher
      )
    ),
    Layer.merge(
      ChannelGateLive.pipe(
        Layer.provide(
          Layer.mergeAll(platforms, readers, engagement, live, followUps)
        )
      )
    )
  );
