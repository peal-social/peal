using NUnit.Framework;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Inbox.Messages;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetSettingsTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
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
                    .WithPath("/api/v1/inbox/messages/settings")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Inbox.Messages.GetSettingsAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
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
                    .WithPath("/api/v1/inbox/messages/settings")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Inbox.Messages.GetSettingsAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }
}
