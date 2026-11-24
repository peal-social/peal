<?php

namespace Peal\Slideshows;

use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;
use Peal\Slideshows\Requests\ListSlideshowsRequest;
use Peal\Types\Slideshows;
use Peal\Exceptions\PealException;
use Peal\Exceptions\PealApiException;
use Peal\Core\Json\JsonApiRequest;
use Peal\Environments;
use Peal\Core\Client\HttpMethod;
use JsonException;
use Psr\Http\Client\ClientExceptionInterface;
use Peal\Slideshows\Requests\SlideshowRequest;
use Peal\Types\Slideshow;
use Peal\Slideshows\Requests\EditRenderRequest;

class SlideshowsClient
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
     * Lists the slide videos the workspace asked for, newest first, 50 at most, only those with `status` when given. Needs assistant:use.
     *
     * Example:
     * ```php
     * $client->slideshows->list(
     *     'workspaceId',
     *     new ListSlideshowsRequest([]),
     * );
     * ```
     *
     * @param string $workspaceId
     * @param ListSlideshowsRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?Slideshows
     * @throws PealException
     * @throws PealApiException
     */
    public function list(string $workspaceId, ListSlideshowsRequest $request = new ListSlideshowsRequest(), ?array $options = null): ?Slideshows
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
                    path: "api/workspaces/{$workspaceId}/media/slideshows",
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
                return Slideshows::fromJson($json);
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
     * Asks the service the workspace chose for slide videos (`PUT .../assistant/models/composition`, Shotstack) to compose 2 to 10 images of its library, in order, each with an optional caption and motion, optionally over a voice-over of its library, in the aspect asked, and answers 202 with the job, `queued`. Each slide lasts `secondsPerSlide`, or the voice-over's length shared between them, 90 seconds at most in all. Follow it with `GET .../media/slideshows/{id}`; once `succeeded`, the video is a file of the media library (`mediaId`, MP4 at 1080p), marked `aiGenerated` when a file it is made of was, and the member who asked is told in the app. The service receives each file through a link that works for an hour, and renders with the workspace's own key, under its terms and at its prices: Peal bills nothing for it. Its sandbox, when the connection names it, is free and watermarks every video. On a server that bills, it needs a payment method on the workspace's billing account (CompositionNeedsPayment). One slide video at a time a workspace (CompositionBusy), 20 a UTC day (CompositionAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is composed fails it (`interrupted`). Neither the captions nor the video are logged, and the captions are kept only while the video is composed. Needs assistant:use and media:upload.
     *
     * Example:
     * ```php
     * $client->slideshows->create(
     *     'workspaceId',
     *     new SlideshowRequest([
     *         'aspect' => ImageAspect::Square->value,
     *         'slides' => [
     *             new Slide([
     *                 'mediaId' => 'mediaId',
     *             ]),
     *         ],
     *     ]),
     * );
     * ```
     *
     * @param string $workspaceId
     * @param SlideshowRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?Slideshow
     * @throws PealException
     * @throws PealApiException
     */
    public function create(string $workspaceId, SlideshowRequest $request, ?array $options = null): ?Slideshow
    {
        $options = array_merge($this->options, $options ?? []);
        $options['maxRetries'] = 0;
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/workspaces/{$workspaceId}/media/slideshows",
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
                return Slideshow::fromJson($json);
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
     * Asks the service the workspace chose for slide videos (`PUT .../assistant/models/composition`, Shotstack) to render a whole [Shotstack Edit](https://shotstack.io/docs/api/#tocs_edit), as a video editor writes it, with the workspace's own Shotstack connection, and answers 202 with the job, `queued`, as a slide video's. A file of the workspace's library is named `peal:media/<mediaId>`: a ready file whose kind its asset takes (images for image assets, videos for video assets, audio for audio assets and the soundtrack, audio or video for captions, an image or a video for a luma matte); a font may also come from `https://fonts.gstatic.com/`; an asset Shotstack generates from a `prompt` needs no file; any other address is refused, and so are merge fields. Peal renders an MP4 (`format` `mp4` or none), at `preview`, `mobile`, `sd`, `hd` or `1080` (none: 1080p), in 16:9, 9:16 or 1:1 (none: 16:9, which gives the job's `aspect`), at 30 frames a second at most, without `size`, `range`, `scaleTo`, `repeat`, `poster` or `thumbnail`; it replaces the destinations, so Shotstack hosts no copy, turns the timeline's cache off and drops `callback` and `disk`. At most 20 tracks and 200 clips, and every clip whose start and length are numbers ends by 300 seconds (`durationSeconds` is the latest such end). The job lists every library file the edit names in `imageMediaIds`, images or not. Follow it with `GET .../media/slideshows/{id}`; once `succeeded`, the video is a file of the media library. The service receives each file through a link that works for an hour and renders with the workspace's own key, under its terms and at its prices: Peal bills nothing for it. On a server that bills, it needs a payment method on the workspace's billing account (CompositionNeedsPayment). One job at a time a workspace (CompositionBusy) and 20 a UTC day (CompositionAllowanceReached), shared with slide videos, whatever each ends with. The edit is never logged, and is kept only while the video is rendered. Needs assistant:use and media:upload.
     *
     * Example:
     * ```php
     * $client->slideshows->createFromEdit(
     *     'workspaceId',
     *     new EditRenderRequest([
     *         'edit' => [
     *             'key' => "value",
     *         ],
     *     ]),
     * );
     * ```
     *
     * @param string $workspaceId
     * @param EditRenderRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?Slideshow
     * @throws PealException
     * @throws PealApiException
     */
    public function createFromEdit(string $workspaceId, EditRenderRequest $request, ?array $options = null): ?Slideshow
    {
        $options = array_merge($this->options, $options ?? []);
        $options['maxRetries'] = 0;
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/workspaces/{$workspaceId}/media/slideshows/edits",
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
                return Slideshow::fromJson($json);
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
     * Reads where a slide video stands: queued, running, succeeded with its file (`mediaId`), or failed with why (`reason`). Needs assistant:use.
     *
     * Example:
     * ```php
     * $client->slideshows->get(
     *     'workspaceId',
     *     'slideshowId',
     * );
     * ```
     *
     * @param string $workspaceId
     * @param string $slideshowId
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?Slideshow
     * @throws PealException
     * @throws PealApiException
     */
    public function get(string $workspaceId, string $slideshowId, ?array $options = null): ?Slideshow
    {
        $options = array_merge($this->options, $options ?? []);
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/workspaces/{$workspaceId}/media/slideshows/{$slideshowId}",
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
                return Slideshow::fromJson($json);
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
