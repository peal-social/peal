<?php

namespace Peal\Inbox;

use Peal\Inbox\Comments\CommentsClient;
use Peal\Inbox\Messages\MessagesClient;
use Peal\Inbox\Reviews\ReviewsClient;
use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;

class InboxClient
{
    /**
     * @var CommentsClient $comments
     */
    public CommentsClient $comments;

    /**
     * @var MessagesClient $messages
     */
    public MessagesClient $messages;

    /**
     * @var ReviewsClient $reviews
     */
    public ReviewsClient $reviews;

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
        $this->comments = new CommentsClient($this->client, $this->options);
        $this->messages = new MessagesClient($this->client, $this->options);
        $this->reviews = new ReviewsClient($this->client, $this->options);
    }
}
