using global::System.Text.Json.Serialization;
using Peal.Core;

namespace Peal.Workspace;

[Serializable]
public record RevokeInvitationsRequest
{
    [JsonIgnore]
    public required string InvitationId { get; set; }

    /// <inheritdoc />
    public override string ToString()
    {
        return JsonUtils.Serialize(this);
    }
}
