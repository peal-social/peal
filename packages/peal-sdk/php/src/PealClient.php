<?php

namespace Peal;

use Peal\Posts\PostsClient;
use Peal\Approvals\ApprovalsClient;
use Peal\Channels\ChannelsClient;
use Peal\Media\MediaClient;
use Peal\Analytics\AnalyticsClient;
use Peal\Ads\AdsClient;
use Peal\Articles\ArticlesClient;
use Peal\Links\LinksClient;
use Peal\Webhooks\WebhooksClient;
use Peal\Assistant\AssistantClient;
use Peal\Partner\PartnerClient;
use Peal\Credential\CredentialClient;
use Peal\System\SystemClient;
use Peal\Automations\AutomationsClient;
use Peal\Inbox\InboxClient;
use Peal\Workspace\WorkspaceClient;
use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;

class PealClient
{
    /**
     * @var PostsClient $posts
     */
    public PostsClient $posts;

    /**
     * @var ApprovalsClient $approvals
     */
    public ApprovalsClient $approvals;

    /**
     * @var ChannelsClient $channels
     */
    public ChannelsClient $channels;

    /**
     * @var MediaClient $media
     */
    public MediaClient $media;

    /**
     * @var AnalyticsClient $analytics
     */
    public AnalyticsClient $analytics;

    /**
     * @var AdsClient $ads
     */
    public AdsClient $ads;

    /**
     * @var ArticlesClient $articles
     */
    public ArticlesClient $articles;

    /**
     * @var LinksClient $links
     */
    public LinksClient $links;

    /**
     * @var WebhooksClient $webhooks
     */
    public WebhooksClient $webhooks;

    /**
     * @var AssistantClient $assistant
     */
    public AssistantClient $assistant;

    /**
     * @var PartnerClient $partner
     */
    public PartnerClient $partner;

    /**
     * @var CredentialClient $credential
     */
    public CredentialClient $credential;

    /**
     * @var SystemClient $system
     */
    public SystemClient $system;

    /**
     * @var AutomationsClient $automations
     */
    public AutomationsClient $automations;

    /**
     * @var InboxClient $inbox
     */
    public InboxClient $inbox;

    /**
     * @var WorkspaceClient $workspace
     */
    public WorkspaceClient $workspace;

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
     * @param ?string $token The token to use for authentication.
     * @param ?string $workspace
     * @param ?string $pealVersion
     * @param ?array{
     *   baseUrl?: string,
     *   client?: ClientInterface,
     *   maxRetries?: int,
     *   timeout?: float,
     *   headers?: array<string, string>,
     * } $options
     */
    public function __construct(
        ?string $token = null,
        ?string $workspace = null,
        ?string $pealVersion = null,
        ?array $options = null,
    ) {
        $defaultHeaders = [
            'Peal-Version' => '2026-11-09',
            'X-Fern-Language' => 'PHP',
            'X-Fern-SDK-Name' => 'Peal',
            'X-Fern-SDK-Version' => '0.4.0-beta.1',
            'User-Agent' => 'peal-social/peal/0.4.0-beta.1',
        ];
        if ($token != null) {
            $defaultHeaders['Authorization'] = "Bearer $token";
        }
        if ($workspace != null) {
            $defaultHeaders['Peal-Workspace'] = $workspace;
        }
        if ($pealVersion !== null) {
            $defaultHeaders['Peal-Version'] = $pealVersion;
        }

        $this->options = $options ?? [];

        $this->options['headers'] = array_merge(
            $defaultHeaders,
            $this->options['headers'] ?? [],
        );

        $this->client = new RawClient(
            options: $this->options,
        );

        $this->posts = new PostsClient($this->client, $this->options);
        $this->approvals = new ApprovalsClient($this->client, $this->options);
        $this->channels = new ChannelsClient($this->client, $this->options);
        $this->media = new MediaClient($this->client, $this->options);
        $this->analytics = new AnalyticsClient($this->client, $this->options);
        $this->ads = new AdsClient($this->client, $this->options);
        $this->articles = new ArticlesClient($this->client, $this->options);
        $this->links = new LinksClient($this->client, $this->options);
        $this->webhooks = new WebhooksClient($this->client, $this->options);
        $this->assistant = new AssistantClient($this->client, $this->options);
        $this->partner = new PartnerClient($this->client, $this->options);
        $this->credential = new CredentialClient($this->client, $this->options);
        $this->system = new SystemClient($this->client, $this->options);
        $this->automations = new AutomationsClient($this->client, $this->options);
        $this->inbox = new InboxClient($this->client, $this->options);
        $this->workspace = new WorkspaceClient($this->client, $this->options);
    }
}
