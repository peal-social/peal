using NUnit.Framework;
using Peal;
using Peal.Media_;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Media.Slideshows;

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
              "slides": [
                {
                  "mediaId": "mediaId"
                },
                {
                  "mediaId": "mediaId"
                }
              ]
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
                    .WithPath("/api/v1/media/slideshows")
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

        var response = await Client.Media.Slideshows.CreateAsync(
            new SlideshowRequest
            {
                Aspect = ImageAspect.Square,
                SecondsPerSlide = null,
                Slides = new List<Slide>()
                {
                    new Slide
                    {
                        Caption = null,
                        MediaId = "mediaId",
                        Motion = null,
                    },
                    new Slide
                    {
                        Caption = null,
                        MediaId = "mediaId",
                        Motion = null,
                    },
                },
                Transition = null,
                VoiceoverMediaId = null,
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
              "slides": [
                {
                  "mediaId": "mediaId"
                }
              ]
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
                    .WithPath("/api/v1/media/slideshows")
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

        var response = await Client.Media.Slideshows.CreateAsync(
            new SlideshowRequest
            {
                Aspect = ImageAspect.Square,
                Slides = new List<Slide>() { new Slide { MediaId = "mediaId" } },
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
