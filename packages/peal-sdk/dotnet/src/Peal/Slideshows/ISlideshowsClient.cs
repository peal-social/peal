namespace Peal;

public partial interface ISlideshowsClient
{
    /// <summary>
    /// Lists the slide videos the workspace asked for, newest first, 50 at most, only those with `status` when given. Needs assistant:use.
    /// </summary>
    WithRawResponseTask<Slideshows> ListAsync(
        ListSlideshowsRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Asks the service the workspace chose for slide videos (`PUT .../assistant/models/composition`, Shotstack) to compose 2 to 10 images of its library, in order, each with an optional caption and motion, optionally over a voice-over of its library, in the aspect asked, and answers 202 with the job, `queued`. Each slide lasts `secondsPerSlide`, or the voice-over's length shared between them, 90 seconds at most in all. Follow it with `GET .../media/slideshows/{id}`; once `succeeded`, the video is a file of the media library (`mediaId`, MP4 at 1080p), not marked `aiGenerated`, and the member who asked is told in the app. The service receives each file through a link that works for an hour, and renders with the workspace's own key, under its terms and at its prices: Peal bills nothing for it. Its sandbox, when the connection names it, is free and watermarks every video. On a server that bills, it needs a payment method on the workspace's billing account (CompositionNeedsPayment). One slide video at a time a workspace (CompositionBusy), 20 a UTC day (CompositionAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is composed fails it (`interrupted`). Neither the captions nor the video are logged, and the captions are kept only while the video is composed. Needs assistant:use and media:upload.
    /// </summary>
    WithRawResponseTask<Slideshow> CreateAsync(
        SlideshowRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Reads where a slide video stands: queued, running, succeeded with its file (`mediaId`), or failed with why (`reason`). Needs assistant:use.
    /// </summary>
    WithRawResponseTask<Slideshow> GetAsync(
        GetSlideshowsRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
