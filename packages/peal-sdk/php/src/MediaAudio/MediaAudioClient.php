<?php

namespace Peal\MediaAudio;

use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;
use Peal\MediaAudio\Requests\VoiceoverRequest;
use Peal\Types\Media;
use Peal\Exceptions\PealException;
use Peal\Exceptions\PealApiException;
use Peal\Core\Json\JsonApiRequest;
use Peal\Environments;
use Peal\Core\Client\HttpMethod;
use JsonException;
use Psr\Http\Client\ClientExceptionInterface;
use Peal\MediaAudio\Requests\TranscriptionRequest;
use Peal\Types\Transcript;

class MediaAudioClient
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
     * Asks the provider the workspace chose for voice-overs (`PUT .../assistant/models/speech`) to speak the text, in `voice` when given, and answers with the audio as a new file of the media library, marked `aiGenerated`, without a description. Only the workspace's own provider speaks, with its key, under its terms and at its prices: Peal bills nothing for it. 50 a UTC day (AudioAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest voice-over before anything is asked. Neither the text nor the audio is logged. Needs assistant:use and media:upload.
     *
     * Example:
     * ```php
     * $client->mediaAudio->createVoiceover(
     *     new VoiceoverRequest([
     *         'text' => 'text',
     *     ]),
     * );
     * ```
     *
     * @param VoiceoverRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?Media
     * @throws PealException
     * @throws PealApiException
     */
    public function createVoiceover(VoiceoverRequest $request, ?array $options = null): ?Media
    {
        $options = array_merge($this->options, $options ?? []);
        $options['maxRetries'] = 0;
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/media/voiceovers",
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
                return Media::fromJson($json);
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
     * Sends a ready audio or video file of the media library, of at most 25000000 bytes, to the provider the workspace chose for transcripts (`PUT .../assistant/models/transcription`), and answers with what is said in it. With `saveAsDescription`, the transcript becomes the file's description when it fits one (`descriptionSaved`). Only the workspace's own provider transcribes, with its key, under its terms and at its prices: Peal bills nothing for it. 50 a UTC day (AudioAllowanceReached), whatever each ends with. Neither the file nor the transcript is logged, and the transcript is kept only as the description asked for. Needs assistant:use and media:read, and media:upload to save the description.
     *
     * Example:
     * ```php
     * $client->mediaAudio->transcribe(
     *     'mediaId',
     *     new TranscriptionRequest([]),
     * );
     * ```
     *
     * @param string $mediaId
     * @param TranscriptionRequest $request
     * @param ?array{
     *   baseUrl?: string,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     *   queryParameters?: array<string, mixed>,
     *   bodyProperties?: array<string, mixed>,
     * } $options
     * @return ?Transcript
     * @throws PealException
     * @throws PealApiException
     */
    public function transcribe(string $mediaId, TranscriptionRequest $request = new TranscriptionRequest(), ?array $options = null): ?Transcript
    {
        $options = array_merge($this->options, $options ?? []);
        $options['maxRetries'] = 0;
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/v1/media/{$mediaId}/transcription",
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
                return Transcript::fromJson($json);
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
