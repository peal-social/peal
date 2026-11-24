using NUnit.Framework;
using Peal.Me__;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Me.NotificationPreferences;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class UpdateTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {}
            """;

        const string mockResponse = """
            {
              "email": {
                "automations": true,
                "channelReconnect": true,
                "comments": true,
                "feedStopped": true,
                "postFailed": true,
                "postPublished": true,
                "postReview": true,
                "postUnconfirmed": true,
                "recyclingEnded": true,
                "webhookFailing": true,
                "weeklyDigest": true
              },
              "everyPost": true
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/me/notification-preferences")
                    .WithHeader("Content-Type", "application/json")
                    .UsingPatch()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Me.NotificationPreferences.UpdateAsync(
            new NotificationPreferencesChange { Email = null, EveryPost = null }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {}
            """;

        const string mockResponse = """
            {
              "email": {
                "automations": true,
                "channelReconnect": true,
                "comments": true,
                "feedStopped": true,
                "postFailed": true,
                "postPublished": true,
                "postReview": true,
                "postUnconfirmed": true,
                "recyclingEnded": true,
                "webhookFailing": true,
                "weeklyDigest": true
              },
              "everyPost": true
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/me/notification-preferences")
                    .WithHeader("Content-Type", "application/json")
                    .UsingPatch()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Me.NotificationPreferences.UpdateAsync(
            new NotificationPreferencesChange()
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
