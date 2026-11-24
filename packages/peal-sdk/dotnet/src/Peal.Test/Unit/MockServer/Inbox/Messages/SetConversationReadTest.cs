using NUnit.Framework;
using Peal.Inbox;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Inbox.Messages;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class SetConversationReadTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "read": true
            }
            """;

        const string mockResponse = """
            {
              "channelId": "channelId",
              "id": "id",
              "lastIncomingAt": "lastIncomingAt",
              "lastMessageAt": "lastMessageAt",
              "messages": 1,
              "participants": [
                {
                  "displayName": "displayName",
                  "handle": "handle",
                  "platformId": "platformId"
                },
                {
                  "displayName": "displayName",
                  "handle": "handle",
                  "platformId": "platformId"
                }
              ],
              "readAt": "readAt",
              "request": true,
              "unread": true
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/messages/conversations/conversationId/read")
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

        var response = await Client.Inbox.Messages.SetConversationReadAsync(
            new SetConversationReadMessagesRequest
            {
                ConversationId = "conversationId",
                Read = true,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "read": true
            }
            """;

        const string mockResponse = """
            {
              "channelId": "channelId",
              "id": "id",
              "lastIncomingAt": "lastIncomingAt",
              "lastMessageAt": "lastMessageAt",
              "messages": 1,
              "participants": [
                {
                  "displayName": "displayName",
                  "handle": "handle",
                  "platformId": "platformId"
                }
              ],
              "readAt": "readAt",
              "request": true,
              "unread": true
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/messages/conversations/conversationId/read")
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

        var response = await Client.Inbox.Messages.SetConversationReadAsync(
            new SetConversationReadMessagesRequest
            {
                ConversationId = "conversationId",
                Read = true,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
