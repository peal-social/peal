using NUnit.Framework;
using Peal.Channels;
using Peal.Test.Unit.MockServer;

namespace Peal.Test.Unit.MockServer.Channels.Sets;

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
                    .WithPath("/api/v1/channels/sets/channelSetId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Channels.Sets.DeleteAsync(
                new DeleteSetsRequest { ChannelSetId = "channelSetId" }
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
                    .WithPath("/api/v1/channels/sets/channelSetId")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Channels.Sets.DeleteAsync(
                new DeleteSetsRequest { ChannelSetId = "channelSetId" }
            )
        );
    }
}
