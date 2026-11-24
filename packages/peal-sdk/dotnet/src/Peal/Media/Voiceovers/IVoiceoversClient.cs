using Peal;

namespace Peal.Media_;

public partial interface IVoiceoversClient
{
    /// <summary>
    /// Asks the provider the workspace chose for voice-overs (`PUT .../assistant/models/speech`) to speak the text, in `voice` when given, and answers with the audio as a new file of the media library, marked `aiGenerated`, without a description. Only the workspace's own provider speaks, with its key, under its terms and at its prices: Peal bills nothing for it. 50 a UTC day (AudioAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest voice-over before anything is asked. Neither the text nor the audio is logged. Needs assistant:use and media:upload.
    /// </summary>
    WithRawResponseTask<Peal.Media> CreateAsync(
        VoiceoverRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
