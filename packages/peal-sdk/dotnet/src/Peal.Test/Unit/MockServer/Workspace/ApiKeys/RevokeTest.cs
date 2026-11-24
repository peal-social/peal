using NUnit.Framework;
using Peal.Test.Unit.MockServer;
using Peal.Workspace;

namespace Peal.Test.Unit.MockServer.Workspace.ApiKeys;

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
                    .WithPath("/api/v1/workspace/api-keys/apiKeyId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Workspace.ApiKeys.RevokeAsync(
                new RevokeApiKeysRequest { ApiKeyId = "apiKeyId" }
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
                    .WithPath("/api/v1/workspace/api-keys/apiKeyId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Workspace.ApiKeys.RevokeAsync(
                new RevokeApiKeysRequest { ApiKeyId = "apiKeyId" }
            )
        );
    }
}
