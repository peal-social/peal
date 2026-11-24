using NUnit.Framework;
using Peal.Automations;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Automations.Feeds;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ItemsTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "items": [
                {
                  "digest": "digest",
                  "itemAt": "itemAt",
                  "outcome": "made",
                  "pictureSkipped": "notPublic",
                  "postId": "postId",
                  "reason": "existing",
                  "seenAt": "seenAt"
                },
                {
                  "digest": "digest",
                  "itemAt": "itemAt",
                  "outcome": "made",
                  "pictureSkipped": "notPublic",
                  "postId": "postId",
                  "reason": "existing",
                  "seenAt": "seenAt"
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/feeds/feedId/items")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.Feeds.ItemsAsync(
            new ItemsFeedsRequest { FeedId = "feedId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "items": [
                {
                  "digest": "digest",
                  "itemAt": "itemAt",
                  "outcome": "made",
                  "pictureSkipped": "notPublic",
                  "postId": "postId",
                  "reason": "existing",
                  "seenAt": "seenAt"
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/feeds/feedId/items")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.Feeds.ItemsAsync(
            new ItemsFeedsRequest { FeedId = "feedId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
