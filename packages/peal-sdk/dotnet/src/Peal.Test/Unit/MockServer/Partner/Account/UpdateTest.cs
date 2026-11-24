using NUnit.Framework;
using Peal.Partner_;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Partner.Account;

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
              "accentColor": "accentColor",
              "createdAt": "createdAt",
              "id": "id",
              "logoUrl": "logoUrl",
              "name": "name",
              "returnOrigins": [
                "returnOrigins",
                "returnOrigins"
              ],
              "workspaceId": "workspaceId"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account")
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

        var response = await Client.Partner.Account.UpdateAsync(
            new PartnerChange
            {
                AccentColor = null,
                LogoUrl = null,
                Name = null,
                ReturnOrigins = null,
            }
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
              "accentColor": "accentColor",
              "createdAt": "createdAt",
              "id": "id",
              "logoUrl": "logoUrl",
              "name": "name",
              "returnOrigins": [
                "returnOrigins"
              ],
              "workspaceId": "workspaceId"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account")
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

        var response = await Client.Partner.Account.UpdateAsync(new PartnerChange());
        JsonAssert.AreEqual(response, mockResponse);
    }
}
