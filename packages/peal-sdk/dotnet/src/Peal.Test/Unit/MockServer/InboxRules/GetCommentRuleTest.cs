using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.InboxRules;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetCommentRuleTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
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
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/workspaces/workspaceId/inbox/rules/ruleId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.InboxRules.GetCommentRuleAsync(
            new GetCommentRuleInboxRulesRequest { WorkspaceId = "workspaceId", RuleId = "ruleId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
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
              "id": "id",
              "keywords": [
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
                }
              ],
              "postId": "postId",
              "privateReply": "privateReply",
              "reply": "reply",
              "startedBy": "startedBy",
              "status": "active"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/workspaces/workspaceId/inbox/rules/ruleId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.InboxRules.GetCommentRuleAsync(
            new GetCommentRuleInboxRulesRequest { WorkspaceId = "workspaceId", RuleId = "ruleId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
