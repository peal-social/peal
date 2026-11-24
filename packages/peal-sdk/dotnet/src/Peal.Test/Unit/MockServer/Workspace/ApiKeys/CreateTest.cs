using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;
using Peal.Workspace;

namespace Peal.Test.Unit.MockServer.Workspace.ApiKeys;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class CreateTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "name": "x",
              "permissions": [
                "activity:read",
                "activity:read"
              ]
            }
            """;

        const string mockResponse = """
            {
              "apiKey": {
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
              "key": "key"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/api-keys")
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

        var response = await Client.Workspace.ApiKeys.CreateAsync(
            new NewApiKey
            {
                ExpiresInDays = null,
                Name = "x",
                Permissions = new List<Permission>()
                {
                    Permission.ActivityRead,
                    Permission.ActivityRead,
                },
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "name": "name",
              "permissions": [
                "activity:read"
              ]
            }
            """;

        const string mockResponse = """
            {
              "apiKey": {
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
              },
              "key": "key"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/api-keys")
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

        var response = await Client.Workspace.ApiKeys.CreateAsync(
            new NewApiKey
            {
                Name = "name",
                Permissions = new List<Permission>() { Permission.ActivityRead },
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
