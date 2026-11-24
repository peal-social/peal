using NUnit.Framework;
using Peal.Automations;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Automations.Queues;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class SlotsTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "nextFree": "nextFree",
              "noRoom": "noSlots",
              "slots": [
                {
                  "at": "at",
                  "postId": "postId"
                },
                {
                  "at": "at",
                  "postId": "postId"
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/queues/queueId/slots")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.Queues.SlotsAsync(
            new SlotsQueuesRequest { QueueId = "queueId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "nextFree": "nextFree",
              "noRoom": "noSlots",
              "slots": [
                {
                  "at": "at",
                  "postId": "postId"
                }
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/queues/queueId/slots")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.Queues.SlotsAsync(
            new SlotsQueuesRequest { QueueId = "queueId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
