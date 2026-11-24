using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.InboxMessages;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class SendPrivateReplyTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "commentId": "commentId",
              "text": "x"
            }
            """;

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
                    .WithPath("/api/v1/inbox/messages/private-replies")
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

        var response = await Client.InboxMessages.SendPrivateReplyAsync(
            new NewInboxPrivateReply { CommentId = "commentId", Text = "x" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "commentId": "commentId",
              "text": "text"
            }
            """;

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
                    .WithPath("/api/v1/inbox/messages/private-replies")
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

        var response = await Client.InboxMessages.SendPrivateReplyAsync(
            new NewInboxPrivateReply { CommentId = "commentId", Text = "text" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
