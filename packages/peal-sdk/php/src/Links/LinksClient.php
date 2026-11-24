<?php

namespace Peal\Links;

use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;
use Peal\Types\ShortLinkStatus;
use Peal\Exceptions\PealException;
use Peal\Exceptions\PealApiException;
use Peal\Core\Json\JsonApiRequest;
use Peal\Environments;
use Peal\Core\Client\HttpMethod;
use JsonException;
use Psr\Http\Client\ClientExceptionInterface;
use Peal\Links\Requests\ShortLinkSettings;
use Peal\Links\Requests\ListLinksRequest;
use Peal\Types\ShortLinkPage;
use Peal\Links\Requests\GetLinksRequest;
use Peal\Types\ShortLinkReport;

class LinksClient
{
    /**
     * @var array{
     *   baseUrl?: string,
     *   client?: ClientInterface,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     * } $options @phpstan-ignore-next-line Property is used in endpoint methods via HttpEndpointGenerator
     */
    private array $options;

    /**
     * @var RawClient $client
     */
    private RawClient $client;

    /**
     * @param RawClient $client
     * @param ?array{
     *   baseUrl?: string,
     *   client?: ClientInterface,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     * } $options
     */
    public function __construct(
        RawClient $client,
        ?array $options = null,
    ) {
        $this->client = $client;
        $this->options = $options ?? [];
    }

    /**
     * Answers whether this server shortens links (`available`), what a short address starts with (`base`) and how long it is (`shortLength`), and whether the workspace's new posts ask for short links by default (`byDefault`). A post that leaves `shortenLinks` out takes `byDefault` when it is made (the web app, the API, MCP, the command line and feeds alike), and `false` always wins; on a server without short links, nothing is shortened whatever the default. A post that asks goes out with each link written with `http://` or `https://` and longer than a short address replaced by one, one per channel and link, which redirects to it and counts the visit; the text kept stays as written, and Pinterest, Instagram and TikTok always get links as written, as does a link to a channel's own platform. Needs post:read.
     *
     * Example:
     * ```php
     * $client->links->status();
     * ```
     *
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?ShortLinkStatus
     * @throws PealException
     * @throws PealApiException
     */
    public function status(?array $options = null): ?ShortLinkStatus
    {
        $options = array_merge($this->options, $options ?? []);
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/links/status",
                    method: HttpMethod::GET,
                ),
                $options,
            );
            $statusCode = $response->getStatusCode();
            if ($statusCode >= 200 && $statusCode < 400) {
                $json = $response->getBody()->getContents();
                if (empty($json)) {
                    return null;
                }
                return ShortLinkStatus::fromJson($json);
            }
        } catch (JsonException $e) {
            throw new PealException(message: "Failed to deserialize response: {$e->getMessage()}", previous: $e);
        } catch (ClientExceptionInterface $e) {
            throw new PealException(message: $e->getMessage(), previous: $e);
        }
        throw new PealApiException(
            message: 'API request failed',
            statusCode: $statusCode,
            body: $response->getBody()->getContents(),
        );
    }

    /**
     * Sets whether the workspace's new posts ask for short links unless they say otherwise (`shortenLinks`), whatever makes them: the web app, the API, MCP, the command line and feeds. Each post still chooses for itself, and takes the default when it is made, so a change reaches only posts made after it. Needs organization:update, which owners and admins hold.
     *
     * Example:
     * ```php
     * $client->links->setDefault(
     *     new ShortLinkSettings([
     *         'byDefault' => true,
     *     ]),
     * );
     * ```
     *
     * @param ShortLinkSettings $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?ShortLinkStatus
     * @throws PealException
     * @throws PealApiException
     */
    public function setDefault(ShortLinkSettings $request, ?array $options = null): ?ShortLinkStatus
    {
        $options = array_merge($this->options, $options ?? []);
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/links/settings",
                    method: HttpMethod::PUT,
                    body: $request,
                ),
                $options,
            );
            $statusCode = $response->getStatusCode();
            if ($statusCode >= 200 && $statusCode < 400) {
                $json = $response->getBody()->getContents();
                if (empty($json)) {
                    return null;
                }
                return ShortLinkStatus::fromJson($json);
            }
        } catch (JsonException $e) {
            throw new PealException(message: "Failed to deserialize response: {$e->getMessage()}", previous: $e);
        } catch (ClientExceptionInterface $e) {
            throw new PealException(message: $e->getMessage(), previous: $e);
        }
        throw new PealApiException(
            message: 'API request failed',
            statusCode: $statusCode,
            body: $response->getBody()->getContents(),
        );
    }

    /**
     * Lists the workspace's short links, newest first, 50 a page unless `limit` (at most 100) says otherwise, those of one post (`postId`) or one channel (`channelId`), each with its clicks from `from` to `to` (UTC days, both included, at most 92; by default the 30 days that end today). Pass the page's `nextCursor` as `cursor` for the next one. Clicks are counted by UTC day and kept 400 days; a request from an automated reader (a crawler, a link preview), a prefetch or a HEAD is redirected but not counted, so the figure is approximate, and nothing about the visitor is kept. Needs analytics:read.
     *
     * Example:
     * ```php
     * $client->links->list(
     *     new ListLinksRequest([]),
     * );
     * ```
     *
     * @param ListLinksRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?ShortLinkPage
     * @throws PealException
     * @throws PealApiException
     */
    public function list(ListLinksRequest $request = new ListLinksRequest(), ?array $options = null): ?ShortLinkPage
    {
        $options = array_merge($this->options, $options ?? []);
        $query = [];
        if ($request->channelId != null) {
            $query['channelId'] = $request->channelId;
        }
        if ($request->cursor != null) {
            $query['cursor'] = $request->cursor;
        }
        if ($request->from != null) {
            $query['from'] = $request->from;
        }
        if ($request->limit != null) {
            $query['limit'] = $request->limit;
        }
        if ($request->postId != null) {
            $query['postId'] = $request->postId;
        }
        if ($request->to != null) {
            $query['to'] = $request->to;
        }
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/links",
                    method: HttpMethod::GET,
                    query: $query,
                ),
                $options,
            );
            $statusCode = $response->getStatusCode();
            if ($statusCode >= 200 && $statusCode < 400) {
                $json = $response->getBody()->getContents();
                if (empty($json)) {
                    return null;
                }
                return ShortLinkPage::fromJson($json);
            }
        } catch (JsonException $e) {
            throw new PealException(message: "Failed to deserialize response: {$e->getMessage()}", previous: $e);
        } catch (ClientExceptionInterface $e) {
            throw new PealException(message: $e->getMessage(), previous: $e);
        }
        throw new PealApiException(
            message: 'API request failed',
            statusCode: $statusCode,
            body: $response->getBody()->getContents(),
        );
    }

    /**
     * Answers one short link with its clicks each day from `from` to `to` (UTC days, both included, at most 92; by default the 30 days that end today), oldest first. Clicks are counted by UTC day and kept 400 days; a request from an automated reader (a crawler, a link preview), a prefetch or a HEAD is redirected but not counted, so the figure is approximate, and nothing about the visitor is kept. Needs analytics:read.
     *
     * Example:
     * ```php
     * $client->links->get(
     *     'linkId',
     *     new GetLinksRequest([]),
     * );
     * ```
     *
     * @param string $linkId
     * @param GetLinksRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?ShortLinkReport
     * @throws PealException
     * @throws PealApiException
     */
    public function get(string $linkId, GetLinksRequest $request = new GetLinksRequest(), ?array $options = null): ?ShortLinkReport
    {
        $options = array_merge($this->options, $options ?? []);
        $query = [];
        if ($request->from != null) {
            $query['from'] = $request->from;
        }
        if ($request->to != null) {
            $query['to'] = $request->to;
        }
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/links/{$linkId}",
                    method: HttpMethod::GET,
                    query: $query,
                ),
                $options,
            );
            $statusCode = $response->getStatusCode();
            if ($statusCode >= 200 && $statusCode < 400) {
                $json = $response->getBody()->getContents();
                if (empty($json)) {
                    return null;
                }
                return ShortLinkReport::fromJson($json);
            }
        } catch (JsonException $e) {
            throw new PealException(message: "Failed to deserialize response: {$e->getMessage()}", previous: $e);
        } catch (ClientExceptionInterface $e) {
            throw new PealException(message: $e->getMessage(), previous: $e);
        }
        throw new PealApiException(
            message: 'API request failed',
            statusCode: $statusCode,
            body: $response->getBody()->getContents(),
        );
    }
}
