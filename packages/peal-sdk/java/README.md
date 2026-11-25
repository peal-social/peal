# Peal Java Library


The Peal Java library provides convenient access to the Peal APIs from Java.

## Table of Contents

- [Reference](#reference)
- [Usage](#usage)
- [Environments](#environments)
- [Base Url](#base-url)
- [Exception Handling](#exception-handling)
- [Advanced](#advanced)
  - [Custom Client](#custom-client)
  - [Retries](#retries)
  - [Timeouts](#timeouts)
  - [Custom Headers](#custom-headers)
  - [Additional Body Properties](#additional-body-properties)
  - [Access Raw Response Data](#access-raw-response-data)
- [Contributing](#contributing)

## Installation

With Maven:

```xml
<dependency>
    <groupId>social.peal</groupId>
    <artifactId>peal</artifactId>
    <version>0.4.0-beta.1</version>
</dependency>
```

With Gradle:

```groovy
implementation 'social.peal:peal:0.4.0-beta.1'
```

The SDKs are in beta until general availability. A beta release may change a method or a type, so this installs one exact version, and your project keeps it until you change it. Releases from 0.4 call the API under `/api/v1`, and 0.1 to 0.3 the API before it, which Peal Cloud stops serving when 0.4.0-beta.1 is published.

## Reference

A full reference for this library is available [here](./reference.md).

## Usage

Instantiate and use the client with the following:

```java
package com.example.usage;

import java.util.Arrays;
import social.peal.PealClient;
import social.peal.resources.posts.requests.NewPost;
import social.peal.types.MediaAttachment;
import social.peal.types.PostContent;
import social.peal.types.PostTiming;
import social.peal.types.PostTimingNow;
import social.peal.types.TextOverride;

public class Example {
    public static void main(String[] args) {
        PealClient client = PealClient
            .builder()
            .token("<token>")
            .build();

        client.posts().create(
            NewPost
                .builder()
                .content(
                    PostContent
                        .builder()
                        .text("text")
                        .media(
                            Arrays.asList(
                                MediaAttachment
                                    .builder()
                                    .altText("altText")
                                    .mediaId("mediaId")
                                    .build()
                            )
                        )
                        .overrides(
                            Arrays.asList(
                                TextOverride
                                    .builder()
                                    .channelId("channelId")
                                    .text("text")
                                    .build()
                            )
                        )
                        .build()
                )
                .when(
                    PostTiming.now(
                        PostTimingNow
                            .builder()
                            .build()
                    )
                )
                .channelIds(
                    Arrays.asList("channelIds")
                )
                .build()
        );
    }
}
```

## Environments

This SDK allows you to configure different environments for API requests.

```java
import social.peal.PealClient;
import social.peal.core.Environment;

PealClient client = PealClient
    .builder()
    .environment(Environment.DEFAULT)
    .build();
```

## Base Url

You can set a custom base URL when constructing the client.

```java
import social.peal.PealClient;

PealClient client = PealClient
    .builder()
    .url("https://example.com")
    .build();
```

## Exception Handling

When the API returns a non-success status code (4xx or 5xx response), an API exception will be thrown.

```java
import social.peal.core.PealClientApiException;

try{
    client.posts().create(...);
} catch (PealClientApiException e){
    // Do something with the API exception...
}
```

## Advanced

### Custom Client

This SDK is built to work with any instance of `OkHttpClient`. By default, if no client is provided, the SDK will construct one.
However, you can pass your own client like so:

```java
import okhttp3.OkHttpClient;
import social.peal.PealClient;

OkHttpClient customClient = ...;

PealClient client = PealClient
    .builder()
    .httpClient(customClient)
    .build();
```

### Retries

The SDK is instrumented with automatic retries with exponential backoff. A request will be retried as long
as the request is deemed retryable and the number of retry attempts has not grown larger than the configured
retry limit (default: 2). Before defaulting to exponential backoff, the SDK will first attempt to respect
the `Retry-After` header (as either in seconds or as an HTTP date), and then the `X-RateLimit-Reset` header
(as a Unix timestamp in epoch seconds); failing both of those, it will fall back to exponential backoff.

A request is deemed retryable when any of the following HTTP status codes is returned:

- [408](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/408) (Timeout)
- [429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429) (Too Many Requests)
- [5XX](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#server_error_responses) (All server errors, including 500)


Use the `maxRetries` client option to configure this behavior.

```java
import social.peal.PealClient;

PealClient client = PealClient
    .builder()
    .maxRetries(1)
    .build();
```

### Timeouts

The SDK defaults to a 60 second timeout. You can configure this with a timeout option at the client or request level.
```java
import social.peal.PealClient;
import social.peal.core.RequestOptions;

// Client level
PealClient client = PealClient
    .builder()
    .timeout(60)
    .build();

// Request level
client.posts().create(
    ...,
    RequestOptions
        .builder()
        .timeout(60)
        .build()
);
```

### Custom Headers

The SDK allows you to add custom headers to requests. You can configure headers at the client level or at the request level.

```java
import social.peal.PealClient;
import social.peal.core.RequestOptions;

// Client level
PealClient client = PealClient
    .builder()
    .addHeader("X-Custom-Header", "custom-value")
    .addHeader("X-Request-Id", "abc-123")
    .build();
;

// Request level
client.posts().create(
    ...,
    RequestOptions
        .builder()
        .addHeader("X-Request-Header", "request-value")
        .build()
);
```

### Additional Body Properties

If you need to send a request body property that is not yet part of the SDK (for example, a beta field),
use the `addBodyProperty` request option. Properties are sent with the key exactly as given and override
any property with the same key; for endpoints without a request body, they are sent as a JSON body.
This is supported for JSON and form-urlencoded request bodies, but not for multipart (file upload) requests.

```java
import social.peal.core.RequestOptions;

client.posts().create(
    ...,
    RequestOptions
        .builder()
        .addBodyProperty("extra_field", "extra-value")
        .build()
);
```

### Access Raw Response Data

The SDK provides access to raw response data, including headers, through the `withRawResponse()` method.
The `withRawResponse()` method returns a raw client that wraps all responses with `body()` and `headers()` methods.
(A normal client's `response` is identical to a raw client's `response.body()`.)

```java
PealClientHttpResponse response = client.posts().withRawResponse().create(...);

System.out.println(response.body());
System.out.println(response.headers().get("X-My-Header"));
```

## Contributing

While we value open-source contributions to this SDK, this library is generated programmatically.
Additions made directly to this library would have to be moved over to our generation code,
otherwise they would be overwritten upon the next generated release. Feel free to open a PR as
a proof of concept, but know that we will not be able to merge it as-is. We suggest opening
an issue first to discuss with us!

On the other hand, contributions to the README are always very welcome!
