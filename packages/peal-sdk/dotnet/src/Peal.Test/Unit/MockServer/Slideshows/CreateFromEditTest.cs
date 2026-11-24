using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Slideshows;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class CreateFromEditTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "edit": {
                "edit": {
                  "key": "value"
                }
              }
            }
            """;

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
                    .WithPath("/api/v1/media/slideshows/edits")
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

        var response = await Client.Slideshows.CreateFromEditAsync(
            new EditRenderRequest
            {
                Edit = new Dictionary<string, object?>()
                {
                    {
                        "edit",
                        new Dictionary<object, object?>() { { "key", "value" } }
                    },
                },
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "edit": {
                "key": "value"
              }
            }
            """;

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
                    .WithPath("/api/v1/media/slideshows/edits")
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

        var response = await Client.Slideshows.CreateFromEditAsync(
            new EditRenderRequest
            {
                Edit = new Dictionary<string, object?>() { { "key", "value" } },
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
