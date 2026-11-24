import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { AssistantFailed } from "./assistant-failed.ts";
import { AssistantInputRejected } from "./assistant-input-rejected.ts";
import { AssistantQuotaExceeded } from "./assistant-quota-exceeded.ts";
import { AssistantUnavailable } from "./assistant-unavailable.ts";
import { ImageRequestSchema } from "./assistant.ts";
import { Authentication } from "./authentication.ts";
import { Forbidden } from "./forbidden.ts";
import { ImageProviderRefused } from "./image-provider-refused.ts";
import { MediaImportBusy } from "./media-import-busy.ts";
import { MediaStoreUnavailable } from "./media-store-unavailable.ts";
import { MediaSchema } from "./media.ts";
import { OwnImageLimitReached } from "./own-image-limit-reached.ts";
import { PlanLimitReached } from "./plan-limit-reached.ts";
import { UsageAllowanceReached } from "./usage-allowance-reached.ts";
import { WorkspaceAccess } from "./workspace-access.ts";
import { workspaceHeaders } from "./workspace-header.ts";

/**
 * Images made for the workspace's media library from a prompt, by the
 * workspace's own image provider or the server's.
 */
export class MediaImagesApi extends HttpApiGroup.make("media.images")
  .add(
    HttpApiEndpoint.post("create", "/", {
      error: [
        Forbidden,
        AssistantUnavailable,
        AssistantInputRejected,
        AssistantQuotaExceeded,
        UsageAllowanceReached,
        AssistantFailed,
        ImageProviderRefused,
        OwnImageLimitReached,
        PlanLimitReached,
        MediaStoreUnavailable,
        MediaImportBusy,
      ],
      headers: workspaceHeaders,

      payload: ImageRequestSchema,
      success: MediaSchema.pipe(HttpApiSchema.status(201)),
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Asks for one image from the prompt, in the aspect asked for, and answers with it as a new file of the media library, ready to attach, marked `aiGenerated` and without a description. When the workspace brought its own image provider, the prompt goes there, with the workspace's key, and the image costs none of the workspace's daily requests, on any plan, a trial and the free plan included, within a number of such images a day (OwnImageLimitReached past it); if that provider refuses, the answer is ImageProviderRefused and the server's model is never asked instead. Otherwise the prompt goes to the image provider the server's operator chose. On a server that does not bill, an image costs the status's `images.requestCost` of the workspace's daily requests, given back only when the provider could not be reached. On a server that bills, it needs a payment method on the billing account (UsageAllowanceReached `paymentMethodRequired` without one, before anything is asked) and counts one of the month's images (`images.month`), billed past the allowance up to the account's ceiling (UsageAllowanceReached `ceilingReached`); an image that is not stored, whatever the reason, is not counted. Neither the prompt nor the image is logged. Either way the image takes room in the plan's media storage, which must hold the largest image before anything is asked. The file is stored as the provider gave it. Peal sets no platform's AI label on its own: set it in the post's options (YouTube `containsSyntheticMedia`, TikTok `aiGenerated`, X `madeWithAi`). Needs assistant:use and media:upload. Off unless the workspace brought a provider or the server has an image model (`images.source`).",
        summary: "Make an image into the media library",
      })
    )
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/v1/media/images") {}
