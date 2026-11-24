using NUnit.Framework;
using Peal.Channels;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Channels.TiktokCreator;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "posting": {
                "_tag": "ready",
                "creator": {
                  "avatarUrl": "avatarUrl",
                  "commentDisabled": true,
                  "duetDisabled": true,
                  "maxVideoDurationMs": 1,
                  "nickname": "nickname",
                  "privacyLevels": [
                    "PUBLIC_TO_EVERYONE",
                    "PUBLIC_TO_EVERYONE"
                  ],
                  "stitchDisabled": true,
                  "username": "username"
                }
              },
              "takesPhotos": true
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/channelId/tiktok-creator")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.TiktokCreator.GetAsync(
            new GetTiktokCreatorRequest { ChannelId = "channelId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "posting": {
                "_tag": "ready",
                "creator": {
                  "avatarUrl": "avatarUrl",
                  "commentDisabled": true,
                  "duetDisabled": true,
                  "maxVideoDurationMs": 1,
                  "nickname": "nickname",
                  "privacyLevels": [
                    "PUBLIC_TO_EVERYONE"
                  ],
                  "stitchDisabled": true,
                  "username": "username"
                }
              },
              "takesPhotos": true
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/channelId/tiktok-creator")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.TiktokCreator.GetAsync(
            new GetTiktokCreatorRequest { ChannelId = "channelId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
