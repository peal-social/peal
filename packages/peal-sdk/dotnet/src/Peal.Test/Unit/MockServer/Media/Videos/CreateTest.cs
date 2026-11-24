using NUnit.Framework;
using Peal;
using Peal.Media_;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Media.Videos;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class CreateTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "aspect": "square",
              "prompt": "prompt"
            }
            """;

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
                    .WithPath("/api/v1/media/videos/generations")
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

        var response = await Client.Media.Videos.CreateAsync(
            new VideoGenerationRequest
            {
                Aspect = ImageAspect.Square,
                DurationSeconds = null,
                ImageMediaId = null,
                Prompt = "prompt",
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "aspect": "square",
              "prompt": "prompt"
            }
            """;

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
                    .WithPath("/api/v1/media/videos/generations")
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

        var response = await Client.Media.Videos.CreateAsync(
            new VideoGenerationRequest { Aspect = ImageAspect.Square, Prompt = "prompt" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
