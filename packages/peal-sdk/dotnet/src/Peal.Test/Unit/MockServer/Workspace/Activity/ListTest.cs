using NUnit.Framework;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;
using Peal.Workspace;

namespace Peal.Test.Unit.MockServer.Workspace.Activity;

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
                  "actor": {
                    "_tag": "user",
                    "userId": "userId"
                  },
                  "application": {
                    "id": "id",
                    "name": "name"
                  },
                  "errorCode": "errorCode",
                  "id": "id",
                  "impersonated": true,
                  "objectIds": {
                    "objectIds": "objectIds"
                  },
                  "occurredAt": "occurredAt",
                  "operation": "operation",
                  "requestId": "requestId",
                  "status": 1,
                  "via": "session"
                },
                {
                  "actor": {
                    "_tag": "user",
                    "userId": "userId"
                  },
                  "application": {
                    "id": "id",
                    "name": "name"
                  },
                  "errorCode": "errorCode",
                  "id": "id",
                  "impersonated": true,
                  "objectIds": {
                    "objectIds": "objectIds"
                  },
                  "occurredAt": "occurredAt",
                  "operation": "operation",
                  "requestId": "requestId",
                  "status": 1,
                  "via": "session"
                }
              ],
              "nextCursor": "nextCursor"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/activity")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Workspace.Activity.ListAsync(new ListActivityRequest());
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "items": [
                {
                  "actor": {
                    "_tag": "user"
                  },
                  "application": {
                    "id": "id"
                  },
                  "errorCode": "errorCode",
                  "id": "id",
                  "impersonated": true,
                  "objectIds": {
                    "key": "value"
                  },
                  "occurredAt": "occurredAt",
                  "operation": "operation",
                  "requestId": "requestId",
                  "status": 1,
                  "via": "session"
                }
              ],
              "nextCursor": "nextCursor"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/activity")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Workspace.Activity.ListAsync(new ListActivityRequest());
        JsonAssert.AreEqual(response, mockResponse);
    }
}
