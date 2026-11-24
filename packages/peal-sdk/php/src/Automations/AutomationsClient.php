<?php

namespace Peal\Automations;

use Peal\Automations\CommentRules\CommentRulesClient;
use Peal\Automations\Queues\QueuesClient;
use Peal\Automations\Recycling\RecyclingClient;
use Peal\Automations\FollowUps\FollowUpsClient;
use Peal\Automations\Feeds\FeedsClient;
use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;

class AutomationsClient
{
    /**
     * @var CommentRulesClient $commentRules
     */
    public CommentRulesClient $commentRules;

    /**
     * @var QueuesClient $queues
     */
    public QueuesClient $queues;

    /**
     * @var RecyclingClient $recycling
     */
    public RecyclingClient $recycling;

    /**
     * @var FollowUpsClient $followUps
     */
    public FollowUpsClient $followUps;

    /**
     * @var FeedsClient $feeds
     */
    public FeedsClient $feeds;

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
        $this->commentRules = new CommentRulesClient($this->client, $this->options);
        $this->queues = new QueuesClient($this->client, $this->options);
        $this->recycling = new RecyclingClient($this->client, $this->options);
        $this->followUps = new FollowUpsClient($this->client, $this->options);
        $this->feeds = new FeedsClient($this->client, $this->options);
    }
}
