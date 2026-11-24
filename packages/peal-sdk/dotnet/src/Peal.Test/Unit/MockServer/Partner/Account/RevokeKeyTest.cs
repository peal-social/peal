using NUnit.Framework;
using Peal.Partner_;
using Peal.Test.Unit.MockServer;

namespace Peal.Test.Unit.MockServer.Partner.Account;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class RevokeKeyTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public void MockServerTest_1()
    {
        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account/keys/partnerKeyId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Partner.Account.RevokeKeyAsync(
                new RevokeKeyAccountRequest { PartnerKeyId = "partnerKeyId" }
            )
        );
    }

    [NUnit.Framework.Test]
    public void MockServerTest_2()
    {
        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/partner/account/keys/partnerKeyId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Partner.Account.RevokeKeyAsync(
                new RevokeKeyAccountRequest { PartnerKeyId = "partnerKeyId" }
            )
        );
    }
}
