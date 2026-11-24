using NUnit.Framework;
using Peal.Automations;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Automations.FollowUps;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class CreateTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "likes": 1000000
            }
            """;

        const string mockResponse = """
            {
              "approval": "notNeeded",
              "approvedAt": "approvedAt",
              "approvedBy": "approvedBy",
              "channels": [
                {
                  "channelId": "channelId",
                  "comment": "available",
                  "platform": "x",
                  "repost": "available"
                },
                {
                  "channelId": "channelId",
                  "comment": "available",
                  "platform": "x",
                  "repost": "available"
                }
              ],
              "channelId": "channelId",
              "comment": "comment",
              "createdAt": "createdAt",
              "endedReason": "stopped",
              "followUps": [
                {
                  "armedAt": "armedAt",
                  "channelId": "channelId",
                  "id": "id",
                  "kind": "comment",
                  "likes": 1,
                  "notBefore": "notBefore",
                  "permalink": "permalink",
                  "platformPostId": "platformPostId",
                  "postId": "postId",
                  "reason": "reason",
                  "sentAt": "sentAt",
                  "status": "armed",
                  "targetId": "targetId",
                  "triggeredAt": "triggeredAt",
                  "until": "until"
                },
                {
                  "armedAt": "armedAt",
                  "channelId": "channelId",
                  "id": "id",
                  "kind": "comment",
                  "likes": 1,
                  "notBefore": "notBefore",
                  "permalink": "permalink",
                  "platformPostId": "platformPostId",
                  "postId": "postId",
                  "reason": "reason",
                  "sentAt": "sentAt",
                  "status": "armed",
                  "targetId": "targetId",
                  "triggeredAt": "triggeredAt",
                  "until": "until"
                }
              ],
              "id": "id",
              "likes": 1,
              "postId": "postId",
              "repost": true,
              "startedBy": "startedBy",
              "startedVia": {
                "id": "id",
                "name": "name",
                "via": "web"
              },
              "status": "active"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/follow-ups")
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

        var response = await Client.Automations.FollowUps.CreateAsync(
            new NewFollowUpRule
            {
                ChannelId = null,
                Comment = null,
                Likes = 1000000,
                PostId = null,
                Repost = null,
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "likes": 1
            }
            """;

        const string mockResponse = """
            {
              "approval": "notNeeded",
              "approvedAt": "approvedAt",
              "approvedBy": "approvedBy",
              "channels": [
                {
                  "channelId": "channelId",
                  "comment": "available",
                  "platform": "x",
                  "repost": "available"
                }
              ],
              "channelId": "channelId",
              "comment": "comment",
              "createdAt": "createdAt",
              "endedReason": "stopped",
              "followUps": [
                {
                  "armedAt": "armedAt",
                  "channelId": "channelId",
                  "id": "id",
                  "kind": "comment",
                  "likes": 1,
                  "notBefore": "notBefore",
                  "permalink": "permalink",
                  "platformPostId": "platformPostId",
                  "postId": "postId",
                  "reason": "reason",
                  "sentAt": "sentAt",
                  "status": "armed",
                  "targetId": "targetId",
                  "triggeredAt": "triggeredAt",
                  "until": "until"
                }
              ],
              "id": "id",
              "likes": 1,
              "postId": "postId",
              "repost": true,
              "startedBy": "startedBy",
              "startedVia": {
                "id": "id",
                "name": "name",
                "via": "web"
              },
              "status": "active"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/follow-ups")
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

        var response = await Client.Automations.FollowUps.CreateAsync(
            new NewFollowUpRule { Likes = 1 }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
