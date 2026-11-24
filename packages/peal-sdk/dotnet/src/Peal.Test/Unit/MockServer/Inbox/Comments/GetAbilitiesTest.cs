using NUnit.Framework;
using Peal.Inbox;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Inbox.Comments;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetAbilitiesTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "delete": "available",
              "hide": "available",
              "like": "available",
              "privateReply": "available",
              "read": "available",
              "reply": "available",
              "withdraw": "available"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/comments/channels/channelId/abilities")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Inbox.Comments.GetAbilitiesAsync(
            new GetAbilitiesCommentsRequest { ChannelId = "channelId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "delete": "available",
              "hide": "available",
              "like": "available",
              "privateReply": "available",
              "read": "available",
              "reply": "available",
              "withdraw": "available"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/comments/channels/channelId/abilities")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Inbox.Comments.GetAbilitiesAsync(
            new GetAbilitiesCommentsRequest { ChannelId = "channelId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
