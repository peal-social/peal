using NUnit.Framework;
using Peal.Inbox;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Inbox.Messages;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetPrivateReplyTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "authorId": "authorId",
              "commentId": "commentId",
              "createdAt": "createdAt",
              "id": "id",
              "reason": "channelUnavailable",
              "ruleId": "ruleId",
              "settledAt": "settledAt",
              "status": "sending",
              "text": "text"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/messages/private-replies/privateReplyId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Inbox.Messages.GetPrivateReplyAsync(
            new GetPrivateReplyMessagesRequest { PrivateReplyId = "privateReplyId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "authorId": "authorId",
              "commentId": "commentId",
              "createdAt": "createdAt",
              "id": "id",
              "reason": "channelUnavailable",
              "ruleId": "ruleId",
              "settledAt": "settledAt",
              "status": "sending",
              "text": "text"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/messages/private-replies/privateReplyId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Inbox.Messages.GetPrivateReplyAsync(
            new GetPrivateReplyMessagesRequest { PrivateReplyId = "privateReplyId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
