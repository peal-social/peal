using NUnit.Framework;
using Peal.Channels;
using Peal.Test.Unit.MockServer;

namespace Peal.Test.Unit.MockServer.Channels.DefaultOptions;

[TestFixture]
[Parallelizable(ParallelScope.Self)]
public class ClearTest : BaseMockServerTest
{
    [NUnit.Framework.Test]
    public void MockServerTest_1()
    {
        Server
            .Given(
                WireMock
                    .RequestBuilders.Request.Create()
                    .WithPath("/api/v1/channels/channelId/default-options")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Channels.DefaultOptions.ClearAsync(
                new ClearDefaultOptionsRequest { ChannelId = "channelId" }
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
                    .WithPath("/api/v1/channels/channelId/default-options")
                    .UsingDelete()
            )
            .RespondWith(WireMock.ResponseBuilders.Response.Create().WithStatusCode(200));

        Assert.DoesNotThrowAsync(async () =>
            await Client.Channels.DefaultOptions.ClearAsync(
                new ClearDefaultOptionsRequest { ChannelId = "channelId" }
            )
        );
    }
}
