using NUnit.Framework;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Partner.Account;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ListKeysTest : BaseMockServerTest
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
                "scopes": [
                  "workspaces:read",
                  "workspaces:read"
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
                "scopes": [
                  "workspaces:read",
                  "workspaces:read"
                ],
                "start": "start"
              }
            ]
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account/keys")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Partner.Account.ListKeysAsync();
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
                "scopes": [
                  "workspaces:read"
                ],
                "start": "start"
              }
            ]
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account/keys")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Partner.Account.ListKeysAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }
}
