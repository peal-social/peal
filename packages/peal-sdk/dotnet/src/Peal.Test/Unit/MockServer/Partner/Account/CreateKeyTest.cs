using NUnit.Framework;
using Peal;
using Peal.Partner_;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Partner.Account;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class CreateKeyTest : BaseMockServerTest
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
              ],
              "scopes": [
                "workspaces:read",
                "workspaces:read"
              ]
            }
            """;

        const string mockResponse = """
            {
              "key": "key",
              "partnerKey": {
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
                "scopes": [
                  "workspaces:read",
                  "workspaces:read"
                ],
                "start": "start"
              }
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account/keys")
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

        var response = await Client.Partner.Account.CreateKeyAsync(
            new NewPartnerKey
            {
                ExpiresInDays = null,
                Name = "x",
                Permissions = new List<Permission>()
                {
                    Permission.ActivityRead,
                    Permission.ActivityRead,
                },
                Scopes = new List<PartnerScope>()
                {
                    PartnerScope.WorkspacesRead,
                    PartnerScope.WorkspacesRead,
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
              ],
              "scopes": [
                "workspaces:read"
              ]
            }
            """;

        const string mockResponse = """
            {
              "key": "key",
              "partnerKey": {
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
                "scopes": [
                  "workspaces:read"
                ],
                "start": "start"
              }
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account/keys")
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

        var response = await Client.Partner.Account.CreateKeyAsync(
            new NewPartnerKey
            {
                Name = "name",
                Permissions = new List<Permission>() { Permission.ActivityRead },
                Scopes = new List<PartnerScope>() { PartnerScope.WorkspacesRead },
            }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
