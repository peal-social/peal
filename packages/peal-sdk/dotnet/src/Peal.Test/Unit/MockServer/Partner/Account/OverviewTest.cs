using NUnit.Framework;
using Peal.Partner_;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Partner.Account;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class OverviewTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "account": {
                "overPlan": true
              },
              "next": "next",
              "total": 1,
              "workspaces": [
                {
                  "channels": {
                    "connected": 1,
                    "off": 1,
                    "toReconnect": 1
                  },
                  "externalId": "externalId",
                  "id": "id",
                  "inbox": {
                    "unanswered": 1
                  },
                  "name": "name",
                  "posts": {
                    "awaitingApproval": 1,
                    "failedLast7Days": 1,
                    "mayApprove": true,
                    "scheduledNext7Days": 1,
                    "unconfirmedLast7Days": 1
                  }
                },
                {
                  "channels": {
                    "connected": 1,
                    "off": 1,
                    "toReconnect": 1
                  },
                  "externalId": "externalId",
                  "id": "id",
                  "inbox": {
                    "unanswered": 1
                  },
                  "name": "name",
                  "posts": {
                    "awaitingApproval": 1,
                    "failedLast7Days": 1,
                    "mayApprove": true,
                    "scheduledNext7Days": 1,
                    "unconfirmedLast7Days": 1
                  }
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account/overview")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Partner.Account.OverviewAsync(new OverviewAccountRequest());
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "account": {
                "overPlan": true
              },
              "next": "next",
              "total": 1,
              "workspaces": [
                {
                  "channels": {
                    "connected": 1,
                    "off": 1,
                    "toReconnect": 1
                  },
                  "externalId": "externalId",
                  "id": "id",
                  "inbox": {
                    "unanswered": 1
                  },
                  "name": "name",
                  "posts": {
                    "awaitingApproval": 1,
                    "failedLast7Days": 1,
                    "mayApprove": true,
                    "scheduledNext7Days": 1,
                    "unconfirmedLast7Days": 1
                  }
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account/overview")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Partner.Account.OverviewAsync(new OverviewAccountRequest());
        JsonAssert.AreEqual(response, mockResponse);
    }
}
