using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Posts;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class AttemptsTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            [
              {
                "attempt": 1,
                "finishedAt": "finishedAt",
                "part": 1,
                "refusalCode": "refusalCode",
                "result": "published",
                "retryAt": "retryAt",
                "round": 1,
                "startedAt": "startedAt",
                "targetId": "targetId"
              },
              {
                "attempt": 1,
                "finishedAt": "finishedAt",
                "part": 1,
                "refusalCode": "refusalCode",
                "result": "published",
                "retryAt": "retryAt",
                "round": 1,
                "startedAt": "startedAt",
                "targetId": "targetId"
              }
            ]
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/posts/postId/attempts")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Posts.AttemptsAsync(
            new AttemptsPostsRequest { PostId = "postId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            [
              {
                "attempt": 1,
                "finishedAt": "finishedAt",
                "part": 1,
                "refusalCode": "refusalCode",
                "result": "published",
                "retryAt": "retryAt",
                "round": 1,
                "startedAt": "startedAt",
                "targetId": "targetId"
              }
            ]
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/posts/postId/attempts")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Posts.AttemptsAsync(
            new AttemptsPostsRequest { PostId = "postId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
