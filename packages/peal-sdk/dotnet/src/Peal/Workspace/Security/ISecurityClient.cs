using Peal;

namespace Peal.Workspace;

public partial interface ISecurityClient
{
    /// <summary>
    /// Answers whether the workspace requires two-step verification of every member, and, to a member who may manage members (member:update), how many members' accounts do not have it on. Any member, application or API key of the workspace may read it.
    /// </summary>
    WithRawResponseTask<WorkspaceSecurity> GetAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
