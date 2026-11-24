using NUnit.Framework;
using Peal.Inbox;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Inbox.Messages;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class SetChannelTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "enabled": true
            }
            """;

        const string mockResponse = """
            {
              "applications": [
                {
                  "clientId": "clientId",
                  "grantedAt": "grantedAt",
                  "grantedBy": "grantedBy"
                },
                {
                  "clientId": "clientId",
                  "grantedAt": "grantedAt",
                  "grantedBy": "grantedBy"
                }
              ],
              "channels": [
                {
                  "channelId": "channelId",
                  "enabledAt": "enabledAt",
                  "enabledBy": "enabledBy"
                },
                {
                  "channelId": "channelId",
                  "enabledAt": "enabledAt",
                  "enabledBy": "enabledBy"
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/messages/channels/channelId")
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

        var response = await Client.Inbox.Messages.SetChannelAsync(
            new SetChannelMessagesRequest { ChannelId = "channelId", Enabled = true }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "enabled": true
            }
            """;

        const string mockResponse = """
            {
              "applications": [
                {
                  "clientId": "clientId",
                  "grantedAt": "grantedAt",
                  "grantedBy": "grantedBy"
                }
              ],
              "channels": [
                {
                  "channelId": "channelId",
                  "enabledAt": "enabledAt",
                  "enabledBy": "enabledBy"
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/messages/channels/channelId")
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

        var response = await Client.Inbox.Messages.SetChannelAsync(
            new SetChannelMessagesRequest { ChannelId = "channelId", Enabled = true }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
