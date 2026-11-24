using Peal;

namespace Peal.Media_;

public partial interface ITranscriptionsClient
{
    /// <summary>
    /// Sends a ready audio or video file of the media library, of at most 25000000 bytes, to the provider the workspace chose for transcripts (`PUT .../assistant/models/transcription`), and answers with what is said in it. With `saveAsDescription`, the transcript becomes the file's description when it fits one (`descriptionSaved`). Only the workspace's own provider transcribes, with its key, under its terms and at its prices: Peal bills nothing for it. 50 a UTC day (AudioAllowanceReached), whatever each ends with. Neither the file nor the transcript is logged, and the transcript is kept only as the description asked for. Needs assistant:use and media:read, and media:upload to save the description.
    /// </summary>
    WithRawResponseTask<Transcript> CreateAsync(
        TranscriptionRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
