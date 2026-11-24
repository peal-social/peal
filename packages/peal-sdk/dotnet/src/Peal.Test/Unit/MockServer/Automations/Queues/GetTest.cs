using NUnit.Framework;
using Peal.Automations;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Automations.Queues;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class GetTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "channelIds": [
                "channelIds",
                "channelIds"
              ],
              "channelSetId": "channelSetId",
              "createdAt": "createdAt",
              "id": "id",
              "isDefault": true,
              "name": "name",
              "slots": [
                {
                  "day": "monday",
                  "time": "time"
                },
                {
                  "day": "monday",
                  "time": "time"
                }
              ],
              "timeZone": "timeZone",
              "unavailableChannelIds": [
                "unavailableChannelIds",
                "unavailableChannelIds"
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/queues/queueId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.Queues.GetAsync(
            new GetQueuesRequest { QueueId = "queueId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "channelIds": [
                "channelIds"
              ],
              "channelSetId": "channelSetId",
              "createdAt": "createdAt",
              "id": "id",
              "isDefault": true,
              "name": "name",
              "slots": [
                {
                  "day": "monday",
                  "time": "time"
                }
              ],
              "timeZone": "timeZone",
              "unavailableChannelIds": [
                "unavailableChannelIds"
              ]
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/queues/queueId")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Automations.Queues.GetAsync(
            new GetQueuesRequest { QueueId = "queueId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
