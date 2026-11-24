using NUnit.Framework;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Workspace.ApiKeys;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ListTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            [
              {
                "createdAt": "createdAt",
                "createdBy": {
                  "id": "id",
                  "name": "name"
                },
                "expiresAt": "expiresAt",
                "id": "id",
                "name": "name",
                "permissions": [
                  "activity:read",
                  "activity:read"
                ],
                "start": "start"
              },
              {
                "createdAt": "createdAt",
                "createdBy": {
                  "id": "id",
                  "name": "name"
                },
                "expiresAt": "expiresAt",
                "id": "id",
                "name": "name",
                "permissions": [
                  "activity:read",
                  "activity:read"
                ],
                "start": "start"
              }
            ]
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/api-keys")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Workspace.ApiKeys.ListAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            [
              {
                "createdAt": "createdAt",
                "createdBy": {
                  "id": "id",
                  "name": "name"
                },
                "expiresAt": "expiresAt",
                "id": "id",
                "name": "name",
                "permissions": [
                  "activity:read"
                ],
                "start": "start"
              }
            ]
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/api-keys")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Workspace.ApiKeys.ListAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }
}
