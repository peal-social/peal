using NUnit.Framework;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Channels;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class PlatformsTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "instagramConnections": [
                "instagramLogin",
                "instagramLogin"
              ],
              "linkedinConnections": [
                "linkedinProfile",
                "linkedinProfile"
              ],
              "platforms": [
                "x",
                "x"
              ],
              "chats": [
                "discord",
                "discord"
              ],
              "sites": [
                "wordpress",
                "wordpress"
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/platforms")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.PlatformsAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "instagramConnections": [
                "instagramLogin"
              ],
              "linkedinConnections": [
                "linkedinProfile"
              ],
              "platforms": [
                "x"
              ],
              "chats": [
                "discord"
              ],
              "sites": [
                "wordpress"
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/platforms")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Channels.PlatformsAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }
}
