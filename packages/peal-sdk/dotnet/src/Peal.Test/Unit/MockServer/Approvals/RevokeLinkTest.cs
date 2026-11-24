using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Approvals;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class RevokeLinkTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string mockResponse = """
            {
              "access": "view",
              "createdAt": "createdAt",
              "createdBy": "createdBy",
              "expiresAt": "expiresAt",
              "id": "id",
              "postId": "postId",
              "revokedAt": "revokedAt",
              "status": "active"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/approvals/links/linkId")
                    .UsingDelete()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Approvals.RevokeLinkAsync(
            new RevokeLinkApprovalsRequest { LinkId = "linkId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string mockResponse = """
            {
              "access": "view",
              "createdAt": "createdAt",
              "createdBy": "createdBy",
              "expiresAt": "expiresAt",
              "id": "id",
              "postId": "postId",
              "revokedAt": "revokedAt",
              "status": "active"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/approvals/links/linkId")
                    .UsingDelete()
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Approvals.RevokeLinkAsync(
            new RevokeLinkApprovalsRequest { LinkId = "linkId" }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
