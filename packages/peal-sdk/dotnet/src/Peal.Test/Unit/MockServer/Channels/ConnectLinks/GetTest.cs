using NUnit.Framework;
using Peal.Channels;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Channels.ConnectLinks;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "channelId": "channelId",
              "channelIds": [
                "channelIds",
                "channelIds"
              ],
              "connectedPlatforms": [
                "x",
                "x"
              ],
              "completedAt": "completedAt",
              "createdAt": "createdAt",
              "expiresAt": "expiresAt",
              "failedAt": "failedAt",
              "failure": "platformNotSupported",
              "id": "id",
              "platform": "x",
              "platforms": [
                "x",
                "x"
              ],
              "returnUrl": "returnUrl",
              "status": "pending"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/connect-links/linkId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.ConnectLinks.GetAsync(
            new GetConnectLinksRequest { LinkId = "linkId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "channelId": "channelId",
              "channelIds": [
                "channelIds"
              ],
              "connectedPlatforms": [
                "x"
              ],
              "completedAt": "completedAt",
              "createdAt": "createdAt",
              "expiresAt": "expiresAt",
              "failedAt": "failedAt",
              "failure": "platformNotSupported",
              "id": "id",
              "platform": "x",
              "platforms": [
                "x"
              ],
              "returnUrl": "returnUrl",
              "status": "pending"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/connect-links/linkId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.ConnectLinks.GetAsync(
            new GetConnectLinksRequest { LinkId = "linkId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
