using NUnit.Framework;
using Peal.Automations;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Automations.CommentRules;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ListTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "items": [
                {
                  "channelId": "channelId",
                  "channels": [
                    {
                      "channelId": "channelId",
                      "platform": "x",
                      "privateReply": "available",
                      "reply": "available"
                    },
                    {
                      "channelId": "channelId",
                      "platform": "x",
                      "privateReply": "available",
                      "reply": "available"
                    }
                  ],
                  "createdAt": "createdAt",
                  "endedReason": "stopped",
                  "holdsPrivateReply": true,
                  "id": "id",
                  "keywords": [
                    "keywords",
                    "keywords"
                  ],
                  "matches": [
                    {
                      "code": "code",
                      "commentId": "commentId",
                      "lookedAt": "lookedAt",
                      "outcome": "claimed",
                      "privateCode": "privateCode",
                      "privateReplyId": "privateReplyId",
                      "privateStatus": "sending",
                      "replyId": "replyId"
                    },
                    {
                      "code": "code",
                      "commentId": "commentId",
                      "lookedAt": "lookedAt",
                      "outcome": "claimed",
                      "privateCode": "privateCode",
                      "privateReplyId": "privateReplyId",
                      "privateStatus": "sending",
                      "replyId": "replyId"
                    }
                  ],
                  "postId": "postId",
                  "privateReply": "privateReply",
                  "reply": "reply",
                  "startedBy": "startedBy",
                  "status": "active"
                },
                {
                  "channelId": "channelId",
                  "channels": [
                    {
                      "channelId": "channelId",
                      "platform": "x",
                      "privateReply": "available",
                      "reply": "available"
                    },
                    {
                      "channelId": "channelId",
                      "platform": "x",
                      "privateReply": "available",
                      "reply": "available"
                    }
                  ],
                  "createdAt": "createdAt",
                  "endedReason": "stopped",
                  "holdsPrivateReply": true,
                  "id": "id",
                  "keywords": [
                    "keywords",
                    "keywords"
                  ],
                  "matches": [
                    {
                      "code": "code",
                      "commentId": "commentId",
                      "lookedAt": "lookedAt",
                      "outcome": "claimed",
                      "privateCode": "privateCode",
                      "privateReplyId": "privateReplyId",
                      "privateStatus": "sending",
                      "replyId": "replyId"
                    },
                    {
                      "code": "code",
                      "commentId": "commentId",
                      "lookedAt": "lookedAt",
                      "outcome": "claimed",
                      "privateCode": "privateCode",
                      "privateReplyId": "privateReplyId",
                      "privateStatus": "sending",
                      "replyId": "replyId"
                    }
                  ],
                  "postId": "postId",
                  "privateReply": "privateReply",
                  "reply": "reply",
                  "startedBy": "startedBy",
                  "status": "active"
                }
              ],
              "nextCursor": "nextCursor"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/comment-rules")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.CommentRules.ListAsync(
            new ListCommentRulesRequest()
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "items": [
                {
                  "channelId": "channelId",
                  "channels": [
                    {
                      "channelId": "channelId",
                      "platform": "x",
                      "privateReply": "available",
                      "reply": "available"
                    }
                  ],
                  "createdAt": "createdAt",
                  "endedReason": "stopped",
                  "holdsPrivateReply": true,
                  "id": "id",
                  "keywords": [
                    "keywords"
                  ],
                  "matches": [
                    {
                      "commentId": "commentId",
                      "lookedAt": "lookedAt",
                      "outcome": "claimed"
                    }
                  ],
                  "postId": "postId",
                  "privateReply": "privateReply",
                  "reply": "reply",
                  "startedBy": "startedBy",
                  "status": "active"
                }
              ],
              "nextCursor": "nextCursor"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/comment-rules")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.CommentRules.ListAsync(
            new ListCommentRulesRequest()
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
