using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Channels;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ConnectChatTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "platform": "discord",
              "webhookUrl": "x"
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
                    .WithPath("/api/v1/channels/chats")
                    .UsingPost()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.ConnectChatAsync(
            new ConnectChat(
                new ConnectChat.Discord(
                    new ConnectDiscordChat { ChannelId = null, WebhookUrl = "x" }
                )
            )
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "platform": "discord",
              "webhookUrl": "webhookUrl"
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
                    .WithPath("/api/v1/channels/chats")
                    .UsingPost()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.ConnectChatAsync(
            new ConnectChat(
                new ConnectChat.Discord(new ConnectDiscordChat { WebhookUrl = "webhookUrl" })
            )
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
