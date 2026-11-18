<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class BrowserAnalytics extends JsonSerializableType
{
    /**
     * @var string $token
     */
    #[JsonProperty('token')]
    public string $token;

    /**
     * @var string $environment
     */
    #[JsonProperty('environment')]
    public string $environment;

    /**
     * @var value-of<BrowserAnalyticsConsent> $consent
     */
    #[JsonProperty('consent')]
    public string $consent;

    /**
     * @var ?string $decidedAt
     */
    #[JsonProperty('decidedAt')]
    public ?string $decidedAt;

    /**
     * @var array<string> $excludedWorkspaceIds
     */
    #[JsonProperty('excludedWorkspaceIds'), ArrayType(['string'])]
    public array $excludedWorkspaceIds;

    /**
     * @param array{
     *   token: string,
     *   environment: string,
     *   consent: value-of<BrowserAnalyticsConsent>,
     *   excludedWorkspaceIds: array<string>,
     *   decidedAt?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->token = $values['token'];
        $this->environment = $values['environment'];
        $this->consent = $values['consent'];
        $this->decidedAt = $values['decidedAt'] ?? null;
        $this->excludedWorkspaceIds = $values['excludedWorkspaceIds'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
