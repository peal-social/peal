<?php

namespace Peal\Media\Videos;

use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;
use Peal\Media\Videos\Requests\ListVideosRequest;
use Peal\Types\VideoGenerations;
use Peal\Exceptions\PealException;
use Peal\Exceptions\PealApiException;
use Peal\Core\Json\JsonApiRequest;
use Peal\Environments;
use Peal\Core\Client\HttpMethod;
use JsonException;
use Psr\Http\Client\ClientExceptionInterface;
use Peal\Media\Videos\Requests\VideoGenerationRequest;
use Peal\Types\VideoGeneration;

class VideosClient
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
     * Lists the videos the workspace asked for, newest first, 50 at most, only those with `status` when given. Needs assistant:use.
     *
     * Example:
     * ```php
     * $client->media->videos->list(
     *     new ListVideosRequest([]),
     * );
     * ```
     *
     * @param ListVideosRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?VideoGenerations
     * @throws PealException
     * @throws PealApiException
     */
    public function list(ListVideosRequest $request = new ListVideosRequest(), ?array $options = null): ?VideoGenerations
    {
        $options = array_merge($this->options, $options ?? []);
        $query = [];
        if ($request->status != null) {
            $query['status'] = $request->status;
        }
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/media/videos/generations",
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
                return VideoGenerations::fromJson($json);
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
     * Asks the provider the workspace chose for videos (`PUT .../assistant/models/video`) for one video from the prompt, in the aspect asked, optionally of a length and from a first frame, and answers 202 with the job, `queued`: making a video takes minutes. Follow it with `GET .../media/videos/generations/{id}`; once `succeeded`, the video is a file of the media library (`mediaId`), ready to attach, marked `aiGenerated`, and the member who asked is told in the app. Only the workspace's own provider makes videos, with its key, under its terms and at its prices: Peal bills nothing for them. One video at a time a workspace (VideoBusy), 20 a UTC day (VideoAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is made fails it (`interrupted`), as the provider may have made and billed it. Neither the prompt nor the video is logged, and the prompt is kept only while the video is made. Needs assistant:use and media:upload.
     *
     * Example:
     * ```php
     * $client->media->videos->create(
     *     new VideoGenerationRequest([
     *         'aspect' => ImageAspect::Square->value,
     *         'prompt' => 'prompt',
     *     ]),
     * );
     * ```
     *
     * @param VideoGenerationRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?VideoGeneration
     * @throws PealException
     * @throws PealApiException
     */
    public function create(VideoGenerationRequest $request, ?array $options = null): ?VideoGeneration
    {
        $options = array_merge($this->options, $options ?? []);
        $options['maxRetries'] = 0;
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/media/videos/generations",
                    method: HttpMethod::POST,
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
                return VideoGeneration::fromJson($json);
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
     * Reads where a video stands: queued, running, succeeded with its file (`mediaId`), or failed with why (`reason`). Needs assistant:use.
     *
     * Example:
     * ```php
     * $client->media->videos->get(
     *     'generationId',
     * );
     * ```
     *
     * @param string $generationId
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?VideoGeneration
     * @throws PealException
     * @throws PealApiException
     */
    public function get(string $generationId, ?array $options = null): ?VideoGeneration
    {
        $options = array_merge($this->options, $options ?? []);
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/media/videos/generations/{$generationId}",
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
                return VideoGeneration::fromJson($json);
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
