using NUnit.Framework;
using Peal.Automations;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Automations.Feeds;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class PreviewTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "url": "url"
            }
            """;

        const string mockResponse = """
            {
              "items": [
                {
                  "link": "link",
                  "picture": "picture",
                  "publishedAt": "publishedAt",
                  "summary": "summary",
                  "text": "text",
                  "title": "title"
                },
                {
                  "link": "link",
                  "picture": "picture",
                  "publishedAt": "publishedAt",
                  "summary": "summary",
                  "text": "text",
                  "title": "title"
                }
              ],
              "title": "title"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/feeds/preview")
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

        var response = await Client.Automations.Feeds.PreviewAsync(
            new FeedPreviewRequest { Template = null, Url = "url" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "url": "url"
            }
            """;

        const string mockResponse = """
            {
              "items": [
                {
                  "link": "link",
                  "picture": "picture",
                  "publishedAt": "publishedAt",
                  "summary": "summary",
                  "text": "text",
                  "title": "title"
                }
              ],
              "title": "title"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/feeds/preview")
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

        var response = await Client.Automations.Feeds.PreviewAsync(
            new FeedPreviewRequest { Url = "url" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
