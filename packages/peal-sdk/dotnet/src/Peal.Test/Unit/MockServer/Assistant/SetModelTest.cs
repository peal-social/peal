using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Assistant;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class SetModelTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "provider": "anthropic"
            }
            """;

        const string mockResponse = """
            {
              "capability": "text",
              "model": "model",
              "provider": "anthropic",
              "serverModel": true,
              "updatedAt": "updatedAt"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/assistant/models/text")
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

        var response = await Client.Assistant.SetModelAsync(
            new AiCapabilityModelChange
            {
                Capability = AiCapability.Text,
                Model = null,
                Provider = AiProvider.Anthropic,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "provider": "anthropic"
            }
            """;

        const string mockResponse = """
            {
              "capability": "text",
              "model": "model",
              "provider": "anthropic",
              "serverModel": true,
              "updatedAt": "updatedAt"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/assistant/models/text")
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

        var response = await Client.Assistant.SetModelAsync(
            new AiCapabilityModelChange
            {
                Capability = AiCapability.Text,
                Provider = AiProvider.Anthropic,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
