<?php

namespace Peal\Me;

use Peal\Me\Notices\NoticesClient;
use Peal\Me\NotificationPreferences\NotificationPreferencesClient;
use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;
use Peal\Types\Me;
use Peal\Exceptions\PealException;
use Peal\Exceptions\PealApiException;
use Peal\Core\Json\JsonApiRequest;
use Peal\Environments;
use Peal\Core\Client\HttpMethod;
use JsonException;
use Psr\Http\Client\ClientExceptionInterface;

class MeClient
{
    /**
     * @var NoticesClient $notices
     */
    public NoticesClient $notices;

    /**
     * @var NotificationPreferencesClient $notificationPreferences
     */
    public NotificationPreferencesClient $notificationPreferences;

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
        $this->notices = new NoticesClient($this->client, $this->options);
        $this->notificationPreferences = new NotificationPreferencesClient($this->client, $this->options);
    }

    /**
     * Answers with the signed-in user and every workspace they belong to, with their role and permissions in each, whether the account has two-step verification on and a password, and whether each workspace requires it (a workspace that requires it refuses the user while it is off). Where the server measures the web app's use, it also says how, with the person's choice about it. API keys belong to a workspace, not a user, and get 403.
     *
     * Example:
     * ```php
     * $client->me->get();
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
     * @return ?Me
     * @throws PealException
     * @throws PealApiException
     */
    public function get(?array $options = null): ?Me
    {
        $options = array_merge($this->options, $options ?? []);
        try {
            $response = $this->client->sendRequest(
                new JsonApiRequest(
                    baseUrl: $options['baseUrl'] ?? $this->client->options['baseUrl'] ?? Environments::Default_->value,
                    path: "api/me",
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
                return Me::fromJson($json);
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
