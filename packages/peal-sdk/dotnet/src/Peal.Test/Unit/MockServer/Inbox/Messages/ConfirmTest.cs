using NUnit.Framework;
using Peal.Inbox;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Inbox.Messages;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ConfirmTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "sent": true
            }
            """;

        const string mockResponse = """
            {
              "authorId": "authorId",
              "conversationId": "conversationId",
              "createdAt": "createdAt",
              "id": "id",
              "platformMessageId": "platformMessageId",
              "reason": "channelUnavailable",
              "settledAt": "settledAt",
              "status": "sending",
              "text": "text"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/messages/outgoing/messageId/confirmation")
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

        var response = await Client.Inbox.Messages.ConfirmAsync(
            new ConfirmMessagesRequest { MessageId = "messageId", Sent = true }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "sent": true
            }
            """;

        const string mockResponse = """
            {
              "authorId": "authorId",
              "conversationId": "conversationId",
              "createdAt": "createdAt",
              "id": "id",
              "platformMessageId": "platformMessageId",
              "reason": "channelUnavailable",
              "settledAt": "settledAt",
              "status": "sending",
              "text": "text"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/messages/outgoing/messageId/confirmation")
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

        var response = await Client.Inbox.Messages.ConfirmAsync(
            new ConfirmMessagesRequest { MessageId = "messageId", Sent = true }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
