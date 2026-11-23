using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Slideshows;

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
              "durationSeconds": "Infinity",
              "finishedAt": "finishedAt",
              "id": "id",
              "imageMediaIds": [
                "imageMediaIds",
                "imageMediaIds"
              ],
              "mediaId": "mediaId",
              "reason": "unavailable",
              "sandbox": true,
              "startedAt": "startedAt",
              "status": "queued",
              "voiceoverMediaId": "voiceoverMediaId"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/workspaces/workspaceId/media/slideshows/slideshowId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Slideshows.GetAsync(
            new GetSlideshowsRequest { WorkspaceId = "workspaceId", SlideshowId = "slideshowId" }
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
              "durationSeconds": "Infinity",
              "finishedAt": "finishedAt",
              "id": "id",
              "imageMediaIds": [
                "imageMediaIds"
              ],
              "mediaId": "mediaId",
              "reason": "unavailable",
              "sandbox": true,
              "startedAt": "startedAt",
              "status": "queued",
              "voiceoverMediaId": "voiceoverMediaId"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/workspaces/workspaceId/media/slideshows/slideshowId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Slideshows.GetAsync(
            new GetSlideshowsRequest { WorkspaceId = "workspaceId", SlideshowId = "slideshowId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
