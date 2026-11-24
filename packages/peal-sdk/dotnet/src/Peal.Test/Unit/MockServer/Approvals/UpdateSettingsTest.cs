using NUnit.Framework;
using Peal;
using Peal.Test.Unit.MockServer;
using Peal.Test.Utils;

namespace Peal.Test.Unit.MockServer.Approvals;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class UpdateSettingsTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public async Task MockServerTest_1()
    {
        const string requestJson = """
            {
              "approvalPolicy": "never"
            }
            """;

        const string mockResponse = """
            {
              "approvalPolicy": "never"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/approvals/settings")
                    .UsingPut()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Approvals.UpdateSettingsAsync(
            new ReviewSettings { ApprovalPolicy = ApprovalPolicy.Never }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }

    [NUnit.Framework.Test]
    public async Task MockServerTest_2()
    {
        const string requestJson = """
            {
              "approvalPolicy": "never"
            }
            """;

        const string mockResponse = """
            {
              "approvalPolicy": "never"
            }
            """;

        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/approvals/settings")
                    .UsingPut()
                    .WithBodyAsJson(requestJson)
            )
            .RespondWith(
                WireMock
                    .ResponseBuilders.Response.Create()
                    .WithStatusCode(200)
                    .WithBody(mockResponse)
            );

        var response = await Client.Approvals.UpdateSettingsAsync(
            new ReviewSettings { ApprovalPolicy = ApprovalPolicy.Never }
        );
        JsonAssert.AreEqual(response, mockResponse);
    }
}
