// The smoke test, which scripts/test.ts runs against a stand-in API: the
// health check, the credential check with a bearer token, and the error a
// refused token raises.
using Peal;

string baseUrl = Environment.GetEnvironmentVariable("PEAL_API_URL")!;
var peal = new PealClient("peal_test", clientOptions: new ClientOptions { BaseUrl = baseUrl });

await peal.System.HealthAsync();
var credential = await peal.Credential.GetAsync();

if (!credential.TryAsApiKey(out var key) || key is null || key.Workspace.Name != "Studio"
    || key.ExpiresAt is not null || key.Start is not null
    || !key.Permissions.Contains(Permission.PostSchedule))
{
    throw new InvalidOperationException($"Unexpected answer: {credential}");
}

try
{
    await new PealClient("refused", clientOptions: new ClientOptions { BaseUrl = baseUrl }).Credential.GetAsync();
    throw new InvalidOperationException("A refused token got an answer");
}
catch (PealClientApiException error) when (error.StatusCode == 401)
{
    // The 401 the stand-in answers a refused token.
}

Console.WriteLine("ok");
