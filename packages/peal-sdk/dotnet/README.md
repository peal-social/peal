# Peal C# Library

[![nuget shield](https://img.shields.io/nuget/v/Peal)](https://nuget.org/packages/Peal)

The Peal C# library provides convenient access to the Peal APIs from C#.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Reference](#reference)
- [Usage](#usage)
- [Environments](#environments)
- [Exception Handling](#exception-handling)
- [Advanced](#advanced)
  - [Retries](#retries)
  - [Timeouts](#timeouts)
  - [Raw Response](#raw-response)
  - [Additional Headers](#additional-headers)
  - [Additional Query Parameters](#additional-query-parameters)
  - [Additional Body Properties](#additional-body-properties)
  - [Forward Compatible Enums](#forward-compatible-enums)
- [Contributing](#contributing)

## Requirements

This SDK requires:
- .NET 8 and above
- .NET Framework 4.6.2 and above
- .NET Standard 2.0 and above

## Installation

```sh
dotnet add package Peal --version 0.4.0-beta.1
```

The SDKs are in beta until general availability. A beta release may change a method or a type, so this installs one exact version, and your project keeps it until you change it. Releases 0.1 to 0.3 call an API that is gone.

## Reference

A full reference for this library is available [here](./reference.md).

## Usage

Instantiate and use the client with the following:

```csharp
using Peal;

var client = new PealClient("TOKEN", "WORKSPACE");
await client.Posts.CreateAsync(
    new NewPost
    {
        ChannelIds = new List<string>() { "channelIds" },
        Content = new PostContent
        {
            Media = new List<MediaAttachment>()
            {
                new MediaAttachment { AltText = "altText", MediaId = "mediaId" },
            },
            Overrides = new List<TextOverride>()
            {
                new TextOverride { ChannelId = "channelId", Text = "text" },
            },
            Text = "text",
        },
        When = new PostTiming(new PostTiming.Now(new PostTimingNow())),
    }
);
```

## Environments

This SDK allows you to configure different environments for API requests.

```csharp
using Peal;

var client = new PealClient(clientOptions: new ClientOptions
{
    BaseUrl = PealClientEnvironment.Default
});
```

## Exception Handling

When the API returns a non-success status code (4xx or 5xx response), a subclass of the following error
will be thrown.

```csharp
using Peal;

try {
    var response = await client.Posts.CreateAsync(...);
} catch (PealClientApiException e) {
    System.Console.WriteLine(e.Body);
    System.Console.WriteLine(e.StatusCode);

    // Access the raw HTTP response (status code, URL, headers) off the exception
    var rawResponse = e.RawResponse;
    if (rawResponse != null)
    {
        System.Console.WriteLine(rawResponse.Url);
        if (rawResponse.Headers.TryGetValue("X-Request-Id", out var requestId))
        {
            System.Console.WriteLine($"Request ID: {requestId}");
        }
    }
}
```

## Advanced

### Retries

The SDK is instrumented with automatic retries with exponential backoff. A request will be retried as long
as the request is deemed retryable and the number of retry attempts has not grown larger than the configured
retry limit (default: 2).

A request is deemed retryable when any of the following HTTP status codes is returned:
- [408](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/408) (Timeout)
- [429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429) (Too Many Requests)
- [5XX](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#server_error_responses) (All server errors, including 500)

Use the `MaxRetries` request option to configure this behavior.

```csharp
var response = await client.Posts.CreateAsync(
    ...,
    new RequestOptions {
        MaxRetries = 0 // Override MaxRetries at the request level
    }
);
```

### Timeouts

The SDK defaults to a 30 second timeout. Use the `Timeout` option to configure this behavior.

```csharp
var response = await client.Posts.CreateAsync(
    ...,
    new RequestOptions {
        Timeout = TimeSpan.FromSeconds(3) // Override timeout to 3s
    }
);
```

### Raw Response

Access raw HTTP response data (status code, headers, URL) alongside parsed response data using the `.WithRawResponse()` method.

```csharp
using Peal;

// Access raw response data (status code, headers, etc.) alongside the parsed response
var result = await client.Posts.CreateAsync(...).WithRawResponse();

// Access the parsed data
var data = result.Data;

// Access raw response metadata
var statusCode = result.RawResponse.StatusCode;
var headers = result.RawResponse.Headers;
var url = result.RawResponse.Url;

// Access specific headers (case-insensitive)
if (headers.TryGetValue("X-Request-Id", out var requestId))
{
    System.Console.WriteLine($"Request ID: {requestId}");
}

// For the default behavior, simply await without .WithRawResponse()
var parsedData = await client.Posts.CreateAsync(...);

// .WithRawResponse() also works on streaming endpoints (returns IAsyncEnumerable<T> + RawResponse)
// and on endpoints with no response body (returns RawResponse only).
```

### Additional Headers

If you would like to send additional headers as part of the request, use the `AdditionalHeaders` request option.

```csharp
var response = await client.Posts.CreateAsync(
    ...,
    new RequestOptions {
        AdditionalHeaders = new Dictionary<string, string?>
        {
            { "X-Custom-Header", "custom-value" }
        }
    }
);
```

### Additional Query Parameters

If you would like to send additional query parameters as part of the request, use the `AdditionalQueryParameters` request option.

```csharp
var response = await client.Posts.CreateAsync(
    ...,
    new RequestOptions {
        AdditionalQueryParameters = new Dictionary<string, string>
        {
            { "custom_param", "custom-value" }
        }
    }
);
```

### Additional Body Properties

If you would like to send additional body properties as part of the request, use the `AdditionalBodyProperties` request option.
These properties are merged into the serialized JSON body using their wire-format names; on a key collision the additional
property wins, and nested objects are merged recursively. If the endpoint has no request body, the additional properties
are sent as the JSON body. Form-urlencoded requests merge the additional properties the same way before encoding;
multipart (file upload) requests are not supported.

```csharp
var response = await client.Posts.CreateAsync(
    ...,
    new RequestOptions {
        AdditionalBodyProperties = new Dictionary<string, object>
        {
            { "custom_field", "custom-value" }
        }
    }
);
```

### Forward Compatible Enums

This SDK uses forward-compatible enums that can handle unknown values gracefully.

```csharp
using Peal;

// Using a built-in value
var listPostsRequestRemoved = ListPostsRequestRemoved.True;

// Using a custom value
var customListPostsRequestRemoved = ListPostsRequestRemoved.FromCustom("custom-value");

// Using in a switch statement
switch (listPostsRequestRemoved.Value)
{
    case ListPostsRequestRemoved.Values.True:
        Console.WriteLine("True");
        break;
    default:
        Console.WriteLine($"Unknown value: {listPostsRequestRemoved.Value}");
        break;
}

// Explicit casting
string listPostsRequestRemovedString = (string)ListPostsRequestRemoved.True;
ListPostsRequestRemoved listPostsRequestRemovedFromString = (ListPostsRequestRemoved)"true";
```

## Contributing

While we value open-source contributions to this SDK, this library is generated programmatically.
Additions made directly to this library would have to be moved over to our generation code,
otherwise they would be overwritten upon the next generated release. Feel free to open a PR as
a proof of concept, but know that we will not be able to merge it as-is. We suggest opening
an issue first to discuss with us!

On the other hand, contributions to the README are always very welcome!
