using NUnit.Framework;
using Peal.Automations;
using Peal.Test.Unit.MockServer;

namespace Peal.Test.Unit.MockServer.Automations.FollowUps;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class DeleteTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public void MockServerTest_1()
    {
        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/automations/follow-ups/ruleId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Automations.FollowUps.DeleteAsync(
                new DeleteFollowUpsRequest { RuleId = "ruleId" }
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
                    .WithPath("/api/v1/automations/follow-ups/ruleId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Automations.FollowUps.DeleteAsync(
                new DeleteFollowUpsRequest { RuleId = "ruleId" }
            )
        );
    }
}
