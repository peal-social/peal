using Peal;

namespace Peal.Media_;

public partial interface IVideosClient
{
    /// <summary>
    /// Lists the videos the workspace asked for, newest first, 50 at most, only those with `status` when given. Needs assistant:use.
    /// </summary>
    WithRawResponseTask<VideoGenerations> ListAsync(
        ListVideosRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Asks the provider the workspace chose for videos (`PUT .../assistant/models/video`) for one video from the prompt, in the aspect asked, optionally of a length and from a first frame, and answers 202 with the job, `queued`: making a video takes minutes. Follow it with `GET .../media/videos/generations/{id}`; once `succeeded`, the video is a file of the media library (`mediaId`), ready to attach, marked `aiGenerated`, and the member who asked is told in the app. Only the workspace's own provider makes videos, with its key, under its terms and at its prices: Peal bills nothing for them. One video at a time a workspace (VideoBusy), 20 a UTC day (VideoAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is made fails it (`interrupted`), as the provider may have made and billed it. Neither the prompt nor the video is logged, and the prompt is kept only while the video is made. Needs assistant:use and media:upload.
    /// </summary>
    WithRawResponseTask<VideoGeneration> CreateAsync(
        VideoGenerationRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Reads where a video stands: queued, running, succeeded with its file (`mediaId`), or failed with why (`reason`). Needs assistant:use.
    /// </summary>
    WithRawResponseTask<VideoGeneration> GetAsync(
        GetVideosRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
