using Peal;

namespace Peal.Posts;

public partial interface IDraftsClient
{
    /// <summary>
    /// Lists the workspace's drafts, newest first, 20 a page unless `limit` (at most 50) says otherwise. Pass the page's `nextCursor` as `cursor` for the next one. Needs post:read.
    /// </summary>
    WithRawResponseTask<DraftPage> ListAsync(
        ListDraftsRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Creates a draft for some of the workspace's channels, possibly none yet, with options on those whose platform takes them (`TargetOptions`, of the channel's platform). Its media must be the workspace's, and ready. Its text, media and options are checked against each platform's rules when it is scheduled, not before. It may name channel sets (`channelSets`, by id or name), whose connected channels it is for as well, with the options each set keeps; a channel of a set that is no longer connected is left out, and the answer says so (`warnings`). A channel on which it gives no options takes the channel's default options, if it has some. With `defaultSignatures`, each channel's default signature goes under its text, and `signatureId` puts one signature under it on every channel: a signature is then text of the post, never added under a text that already ends with it. `shortenLinks: true` sends its links shortened where the server has short links (`links.status`), `false` as written; left out, the post takes the workspace's default (`byDefault`) when it is made, and keeps it. Needs post:create, channel:read, and media:read when it shows media.
    /// </summary>
    WithRawResponseTask<Post> CreateAsync(
        PostDraft request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Deletes a draft. A post scheduled or sent is a conflict: cancel it instead. Needs post:delete, or post:update for the user who created the draft.
    /// </summary>
    WithRawResponseTask DeleteAsync(
        DeleteDraftsRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
