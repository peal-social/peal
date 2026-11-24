using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Inbox;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetThreadTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "abilities": {
                "delete": "available",
                "hide": "available",
                "like": "available",
                "privateReply": "available",
                "read": "available",
                "reply": "available",
                "withdraw": "available"
              },
              "comments": [
                {
                  "author": {
                    "displayName": "displayName",
                    "handle": "handle",
                    "platformId": "platformId"
                  },
                  "forgotten": "expired",
                  "id": "id",
                  "liked": true,
                  "parentId": "parentId",
                  "permalink": "permalink",
                  "privateReply": {
                    "authorId": "authorId",
                    "commentId": "commentId",
                    "createdAt": "createdAt",
                    "id": "id",
                    "reason": "channelUnavailable",
                    "ruleId": "ruleId",
                    "settledAt": "settledAt",
                    "status": "sending",
                    "text": "text"
                  },
                  "privateReplyUntil": "privateReplyUntil",
                  "receivedAt": "receivedAt",
                  "state": "new",
                  "text": "text",
                  "threadId": "threadId",
                  "writtenAt": "writtenAt"
                },
                {
                  "author": {
                    "displayName": "displayName",
                    "handle": "handle",
                    "platformId": "platformId"
                  },
                  "forgotten": "expired",
                  "id": "id",
                  "liked": true,
                  "parentId": "parentId",
                  "permalink": "permalink",
                  "privateReply": {
                    "authorId": "authorId",
                    "commentId": "commentId",
                    "createdAt": "createdAt",
                    "id": "id",
                    "reason": "channelUnavailable",
                    "ruleId": "ruleId",
                    "settledAt": "settledAt",
                    "status": "sending",
                    "text": "text"
                  },
                  "privateReplyUntil": "privateReplyUntil",
                  "receivedAt": "receivedAt",
                  "state": "new",
                  "text": "text",
                  "threadId": "threadId",
                  "writtenAt": "writtenAt"
                }
              ],
              "platform": "x",
              "replies": [
                {
                  "authorId": "authorId",
                  "commentId": "commentId",
                  "createdAt": "createdAt",
                  "id": "id",
                  "permalink": "permalink",
                  "reason": "channelUnavailable",
                  "settledAt": "settledAt",
                  "status": "sending",
                  "text": "text",
                  "threadId": "threadId"
                },
                {
                  "authorId": "authorId",
                  "commentId": "commentId",
                  "createdAt": "createdAt",
                  "id": "id",
                  "permalink": "permalink",
                  "reason": "channelUnavailable",
                  "settledAt": "settledAt",
                  "status": "sending",
                  "text": "text",
                  "threadId": "threadId"
                }
              ],
              "thread": {
                "channelId": "channelId",
                "collectionEnded": "window",
                "comments": 1,
                "id": "id",
                "lastCollectedAt": "lastCollectedAt",
                "lastCommentAt": "lastCommentAt",
                "permalink": "permalink",
                "postId": "postId",
                "publishedAt": "publishedAt",
                "targetId": "targetId",
                "unanswered": 1
              }
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/threads/threadId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Inbox.GetThreadAsync(
            new GetThreadInboxRequest { ThreadId = "threadId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "abilities": {
                "delete": "available",
                "hide": "available",
                "like": "available",
                "privateReply": "available",
                "read": "available",
                "reply": "available",
                "withdraw": "available"
              },
              "comments": [
                {
                  "author": {
                    "handle": "handle",
                    "platformId": "platformId"
                  },
                  "forgotten": "expired",
                  "id": "id",
                  "liked": true,
                  "parentId": "parentId",
                  "permalink": "permalink",
                  "privateReply": {
                    "commentId": "commentId",
                    "createdAt": "createdAt",
                    "id": "id",
                    "status": "sending",
                    "text": "text"
                  },
                  "privateReplyUntil": "privateReplyUntil",
                  "receivedAt": "receivedAt",
                  "state": "new",
                  "text": "text",
                  "threadId": "threadId",
                  "writtenAt": "writtenAt"
                }
              ],
              "platform": "x",
              "replies": [
                {
                  "authorId": "authorId",
                  "commentId": "commentId",
                  "createdAt": "createdAt",
                  "id": "id",
                  "permalink": "permalink",
                  "reason": "channelUnavailable",
                  "settledAt": "settledAt",
                  "status": "sending",
                  "text": "text",
                  "threadId": "threadId"
                }
              ],
              "thread": {
                "channelId": "channelId",
                "collectionEnded": "window",
                "comments": 1,
                "id": "id",
                "lastCollectedAt": "lastCollectedAt",
                "lastCommentAt": "lastCommentAt",
                "permalink": "permalink",
                "postId": "postId",
                "publishedAt": "publishedAt",
                "targetId": "targetId",
                "unanswered": 1
              }
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/inbox/threads/threadId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Inbox.GetThreadAsync(
            new GetThreadInboxRequest { ThreadId = "threadId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
