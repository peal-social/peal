using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.InboxMessages;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ConfirmPrivateReplyTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "went": true
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
                    .WithPath(
                        "/api/workspaces/workspaceId/inbox/messages/private-replies/privateReplyId/confirm"
                    )
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

        var response = await Client.InboxMessages.ConfirmPrivateReplyAsync(
            new ConfirmPrivateReplyInboxMessagesRequest
            {
                WorkspaceId = "workspaceId",
                PrivateReplyId = "privateReplyId",
                Went = true,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "went": true
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
                    .WithPath(
                        "/api/workspaces/workspaceId/inbox/messages/private-replies/privateReplyId/confirm"
                    )
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

        var response = await Client.InboxMessages.ConfirmPrivateReplyAsync(
            new ConfirmPrivateReplyInboxMessagesRequest
            {
                WorkspaceId = "workspaceId",
                PrivateReplyId = "privateReplyId",
                Went = true,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
