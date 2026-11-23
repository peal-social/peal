using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.VideoGenerations;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "aspect": "square",
              "createdAt": "createdAt",
              "durationSeconds": 1,
              "finishedAt": "finishedAt",
              "id": "id",
              "imageMediaId": "imageMediaId",
              "mediaId": "mediaId",
              "reason": "unavailable",
              "startedAt": "startedAt",
              "status": "queued"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/workspaces/workspaceId/media/videos/generations/generationId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.VideoGenerations.GetAsync(
            new GetVideoGenerationsRequest
            {
                WorkspaceId = "workspaceId",
                GenerationId = "generationId",
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "aspect": "square",
              "createdAt": "createdAt",
              "durationSeconds": 1,
              "finishedAt": "finishedAt",
              "id": "id",
              "imageMediaId": "imageMediaId",
              "mediaId": "mediaId",
              "reason": "unavailable",
              "startedAt": "startedAt",
              "status": "queued"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/workspaces/workspaceId/media/videos/generations/generationId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.VideoGenerations.GetAsync(
            new GetVideoGenerationsRequest
            {
                WorkspaceId = "workspaceId",
                GenerationId = "generationId",
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
