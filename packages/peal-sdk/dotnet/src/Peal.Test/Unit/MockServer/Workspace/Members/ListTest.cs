using NUnit.Framework;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Workspace.Members;

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
                "apiKeysAtStake": {
                  "removal": 1,
                  "roles": {
                    "admin": 1,
                    "contributor": 1,
                    "editor": 1,
                    "owner": 1,
                    "viewer": 1
                  }
                },
                "email": "email",
                "joinedAt": "joinedAt",
                "name": "name",
                "role": "role",
                "twoStepEnabled": true,
                "userId": "userId"
              },
              {
                "apiKeysAtStake": {
                  "removal": 1,
                  "roles": {
                    "admin": 1,
                    "contributor": 1,
                    "editor": 1,
                    "owner": 1,
                    "viewer": 1
                  }
                },
                "email": "email",
                "joinedAt": "joinedAt",
                "name": "name",
                "role": "role",
                "twoStepEnabled": true,
                "userId": "userId"
              }
            ]
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/members")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Workspace.Members.ListAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            [
              {
                "apiKeysAtStake": {
                  "removal": 1,
                  "roles": {
                    "admin": 1,
                    "contributor": 1,
                    "editor": 1,
                    "owner": 1,
                    "viewer": 1
                  }
                },
                "email": "email",
                "joinedAt": "joinedAt",
                "name": "name",
                "role": "role",
                "twoStepEnabled": true,
                "userId": "userId"
              }
            ]
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/workspace/members")
                    .UsingGet()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Workspace.Members.ListAsync();
        JsonAssert.AreEqual(response, mockResponse);
    }
}
