# Peal Python Library

[![pypi](https://img.shields.io/pypi/v/peal-sdk)](https://pypi.org/project/peal-sdk/)

The Peal Python library provides convenient access to the Peal APIs from Python.

## Table of Contents

- [Installation](#installation)
- [Reference](#reference)
- [Usage](#usage)
- [Environments](#environments)
- [Async Client](#async-client)
- [Exception Handling](#exception-handling)
- [Advanced](#advanced)
  - [Access Raw Response Data](#access-raw-response-data)
  - [Retries](#retries)
  - [Timeouts](#timeouts)
  - [Custom Client](#custom-client)
- [Contributing](#contributing)

## Installation

```sh
pip install peal-sdk
```

## Reference

A full reference for this library is available [here](./reference.md).

## Usage

Instantiate and use the client with the following:

```python
from peal import Peal, PostContent, MediaAttachment, TextOverride, PostTiming_Now

client = Peal(
    token="<token>",
)

client.posts.create(
    channel_ids=[
        "channelIds"
    ],
    content=PostContent(
        media=[
            MediaAttachment(
                alt_text="altText",
                media_id="mediaId",
            )
        ],
        overrides=[
            TextOverride(
                channel_id="channelId",
                text="text",
            )
        ],
        text="text",
    ),
    when=PostTiming_Now(),
)
```

## Environments

This SDK allows you to configure different environments for API requests.

```python
from peal import Peal
from peal.environment import PealEnvironment

client = Peal(
    environment=PealEnvironment.DEFAULT,
)
```

## Async Client

The SDK also exports an `async` client so that you can make non-blocking calls to our API. Note that if you are constructing an Async httpx client class to pass into this client, use `httpx.AsyncClient()` instead of `httpx.Client()` (e.g. for the `httpx_client` parameter of this client).

```python
import asyncio

from peal import AsyncPeal, PostContent, MediaAttachment, TextOverride, PostTiming_Now

client = AsyncPeal(
    token="<token>",
)


async def main() -> None:
    await client.posts.create(
        channel_ids=[
            "channelIds"
        ],
        content=PostContent(
            media=[
                MediaAttachment(
                    alt_text="altText",
                    media_id="mediaId",
                )
            ],
            overrides=[
                TextOverride(
                    channel_id="channelId",
                    text="text",
                )
            ],
            text="text",
        ),
        when=PostTiming_Now(),
    )


asyncio.run(main())
```

## Exception Handling

When the API returns a non-success status code (4xx or 5xx response), a subclass of the following error
will be thrown.

```python
from peal.core.api_error import ApiError

try:
    client.posts.create(...)
except ApiError as e:
    print(e.status_code)
    print(e.body)
```

## Advanced

### Access Raw Response Data

The SDK provides access to raw response data, including headers, through the `.with_raw_response` property.
The `.with_raw_response` property returns a "raw" client that can be used to access the `.headers` and `.data` attributes.

```python
from peal import Peal

client = Peal(...)
response = client.posts.with_raw_response.create(...)
print(response.headers)  # access the response headers
print(response.status_code)  # access the response status code
print(response.data)  # access the underlying object
```

### Retries

The SDK is instrumented with automatic retries with exponential backoff. A request will be retried as long
as the request is deemed retryable and the number of retry attempts has not grown larger than the configured
retry limit (default: 2).

A request is deemed retryable when any of the following HTTP status codes is returned:
- [408](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/408) (Timeout)
- [409](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409) (Conflict)
- [429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429) (Too Many Requests)
- [5XX](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#server_error_responses) (All server errors, including 500)

Use the `max_retries` request option to configure this behavior.

```python
client.posts.create(..., request_options={
    "max_retries": 1
})
```

### Timeouts

The SDK defaults to a 60 second timeout. You can configure this with a timeout option at the client or request level.

```python
from peal import Peal

client = Peal(..., timeout=20.0)

# Override timeout for a specific method
client.posts.create(..., request_options={
    "timeout": 1
})
```

### Custom Client

You can override the `httpx` client to customize it for your use-case. Some common use-cases include support for proxies
and transports.

```python
import httpx
from peal import Peal

client = Peal(
    ...,
    httpx_client=httpx.Client(
        proxy="http://my.test.proxy.example.com",
        transport=httpx.HTTPTransport(local_address="0.0.0.0"),
    ),
)
```

## Contributing

While we value open-source contributions to this SDK, this library is generated programmatically.
Additions made directly to this library would have to be moved over to our generation code,
otherwise they would be overwritten upon the next generated release. Feel free to open a PR as
a proof of concept, but know that we will not be able to merge it as-is. We suggest opening
an issue first to discuss with us!

On the other hand, contributions to the README are always very welcome!
