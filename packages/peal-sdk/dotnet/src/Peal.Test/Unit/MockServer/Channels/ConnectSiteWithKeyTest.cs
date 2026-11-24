using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Channels;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ConnectSiteWithKeyTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "apiKey": "x",
              "platform": "devto"
            }
            """;

        const string mockResponse = """
            {
              "avatarUrl": "avatarUrl",
              "connection": "instagramLogin",
              "displayName": "displayName",
              "handle": "handle",
              "id": "id",
              "label": "label",
              "platform": "x",
              "status": {
                "_tag": "active"
              },
              "tokenExpiresAt": "tokenExpiresAt"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/websites/keys")
                    .WithHeader("Content-Type", "application/json")
                    .UsingPost()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.ConnectSiteWithKeyAsync(
            new ConnectSiteWithKey
            {
                ApiKey = "x",
                Platform = KeySitePlatform.Devto,
                Publication = null,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "apiKey": "apiKey",
              "platform": "devto"
            }
            """;

        const string mockResponse = """
            {
              "avatarUrl": "avatarUrl",
              "connection": "instagramLogin",
              "displayName": "displayName",
              "handle": "handle",
              "id": "id",
              "label": "label",
              "platform": "x",
              "status": {
                "_tag": "active"
              },
              "tokenExpiresAt": "tokenExpiresAt"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/websites/keys")
                    .WithHeader("Content-Type", "application/json")
                    .UsingPost()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.ConnectSiteWithKeyAsync(
            new ConnectSiteWithKey { ApiKey = "apiKey", Platform = KeySitePlatform.Devto }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
