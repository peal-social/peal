using Peal;

namespace Peal.Workspace;

public partial interface IApiKeysClient
{
    /// <summary>
    /// Lists the workspace's API keys, with the member who made each. Needs apiKey:read.
    /// </summary>
    WithRawResponseTask<IEnumerable<ApiKey>> ListAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Creates an API key for the workspace with some of the caller's permissions, and answers with the key itself, which is not shown again. Needs apiKey:create, and a signed-in member: API keys cannot create keys. The key is the caller's: it stops working once they leave the workspace, are removed or close their account, and once their role no longer holds one of its permissions.
    /// </summary>
    WithRawResponseTask<CreatedApiKey> CreateAsync(
        NewApiKey request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Revokes an API key of the workspace: it stops working at once. Needs apiKey:delete.
    /// </summary>
    WithRawResponseTask RevokeAsync(
        RevokeApiKeysRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
