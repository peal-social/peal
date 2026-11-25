using Peal;

namespace Peal.Channels;

public partial interface ITiktokCreatorClient
{
    /// <summary>
    /// Reads a TikTok channel's creator from TikTok: their nickname, the audiences the account offers, the interactions they turned off and the longest video they may post, or why they cannot post now. A channel the workspace does not have, or that is not TikTok's, is ChannelNotFound; a channel turned off, or whose account must be reconnected (TikTok refused its credential, or it lacks a permission), ChannelCannotPost; TikTok not answering, or refusing the read, PlatformUnreachable; TikTok asking to slow down, PlatformRateLimited. Needs post:create.
    /// </summary>
    WithRawResponseTask<TikTokAccount> GetAsync(
        GetTiktokCreatorRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
