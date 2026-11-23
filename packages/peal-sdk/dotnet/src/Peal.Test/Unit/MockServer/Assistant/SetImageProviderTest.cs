using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Assistant;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class SetImageProviderTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "model": "x"
            }
            """;

        const string mockResponse = """
            {
              "baseUrl": "baseUrl",
              "keySet": true,
              "keyUnreadable": true,
              "model": "model",
              "provider": "openai",
              "updatedAt": "updatedAt"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/workspaces/workspaceId/assistant/image-provider")
                    .WithHeader("Content-Type", "application/json")
                    .UsingPut()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Assistant.SetImageProviderAsync(
            new ImageProviderChange
            {
                WorkspaceId = "workspaceId",
                ApiKey = null,
                BaseUrl = null,
                Model = "x",
                Provider = null,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "model": "model"
            }
            """;

        const string mockResponse = """
            {
              "baseUrl": "baseUrl",
              "keySet": true,
              "keyUnreadable": true,
              "model": "model",
              "provider": "openai",
              "updatedAt": "updatedAt"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/workspaces/workspaceId/assistant/image-provider")
                    .WithHeader("Content-Type", "application/json")
                    .UsingPut()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Assistant.SetImageProviderAsync(
            new ImageProviderChange { WorkspaceId = "workspaceId", Model = "model" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
