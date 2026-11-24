using NUnit.Framework;
using Peal.Test.Unit.MockServer;
using Peal.Workspace;

namespace Peal.Test.Unit.MockServer.Workspace.Invitations;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class RevokeTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public void MockServerTest_1()
    {
        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/invitations/invitationId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Workspace.Invitations.RevokeAsync(
                new RevokeInvitationsRequest { InvitationId = "invitationId" }
            )
        );
    }

    [NUnit.Framework.Test]
    public void MockServerTest_2()
    {
        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/invitations/invitationId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Workspace.Invitations.RevokeAsync(
                new RevokeInvitationsRequest { InvitationId = "invitationId" }
            )
        );
    }
}
