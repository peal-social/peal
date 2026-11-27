using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Articles;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class UnscheduleTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "authorId": "authorId",
              "categories": [
                "categories",
                "categories"
              ],
              "channelId": "channelId",
              "coverMediaId": "coverMediaId",
              "createdAt": "createdAt",
              "excerpt": "excerpt",
              "id": "id",
              "siteStatus": "publish",
              "state": {
                "_tag": "draft"
              },
              "tags": [
                "tags",
                "tags"
              ],
              "title": "title",
              "updatedAt": "updatedAt",
              "body": {
                "content": [
                  {
                    "key": "value"
                  },
                  {
                    "key": "value"
                  }
                ],
                "type": "doc"
              }
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/articles/articleId/unschedule")
                    .UsingPost()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Articles.UnscheduleAsync(
            new UnscheduleArticlesRequest { ArticleId = "articleId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "authorId": "authorId",
              "categories": [
                "categories"
              ],
              "channelId": "channelId",
              "coverMediaId": "coverMediaId",
              "createdAt": "createdAt",
              "excerpt": "excerpt",
              "id": "id",
              "siteStatus": "publish",
              "state": {
                "_tag": "draft"
              },
              "tags": [
                "tags"
              ],
              "title": "title",
              "updatedAt": "updatedAt",
              "body": {
                "content": [
                  {
                    "key": "value"
                  }
                ],
                "type": "doc"
              }
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/articles/articleId/unschedule")
                    .UsingPost()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Articles.UnscheduleAsync(
            new UnscheduleArticlesRequest { ArticleId = "articleId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
