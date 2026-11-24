<?php

namespace Peal\Workspace;

use Peal\Workspace\Security\SecurityClient;
use Peal\Workspace\Activity\ActivityClient;
use Peal\Workspace\ApiKeys\ApiKeysClient;
use Peal\Workspace\Members\MembersClient;
use Peal\Workspace\Invitations\InvitationsClient;
use Peal\Workspace\Billing\BillingClient;
use Peal\Workspace\Usage\UsageClient;
use Psr\Http\Client\ClientInterface;
use Peal\Core\Client\RawClient;

class WorkspaceClient
{
    /**
     * @var SecurityClient $security
     */
    public SecurityClient $security;

    /**
     * @var ActivityClient $activity
     */
    public ActivityClient $activity;

    /**
     * @var ApiKeysClient $apiKeys
     */
    public ApiKeysClient $apiKeys;

    /**
     * @var MembersClient $members
     */
    public MembersClient $members;

    /**
     * @var InvitationsClient $invitations
     */
    public InvitationsClient $invitations;

    /**
     * @var BillingClient $billing
     */
    public BillingClient $billing;

    /**
     * @var UsageClient $usage
     */
    public UsageClient $usage;

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
        $this->security = new SecurityClient($this->client, $this->options);
        $this->activity = new ActivityClient($this->client, $this->options);
        $this->apiKeys = new ApiKeysClient($this->client, $this->options);
        $this->members = new MembersClient($this->client, $this->options);
        $this->invitations = new InvitationsClient($this->client, $this->options);
        $this->billing = new BillingClient($this->client, $this->options);
        $this->usage = new UsageClient($this->client, $this->options);
    }
}
