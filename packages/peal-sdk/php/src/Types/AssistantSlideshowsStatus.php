<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class AssistantSlideshowsStatus extends JsonSerializableType
{
    /**
     * @var bool $available
     */
    #[JsonProperty('available')]
    public bool $available;

    /**
     * @var int $dailyLimit
     */
    #[JsonProperty('dailyLimit')]
    public int $dailyLimit;

    /**
     * @var bool $paymentMethodRequired
     */
    #[JsonProperty('paymentMethodRequired')]
    public bool $paymentMethodRequired;

    /**
     * @var ?value-of<AiProvider> $provider
     */
    #[JsonProperty('provider')]
    public ?string $provider;

    /**
     * @var int $remaining
     */
    #[JsonProperty('remaining')]
    public int $remaining;

    /**
     * @var bool $sandbox
     */
    #[JsonProperty('sandbox')]
    public bool $sandbox;

    /**
     * @param array{
     *   available: bool,
     *   dailyLimit: int,
     *   paymentMethodRequired: bool,
     *   remaining: int,
     *   sandbox: bool,
     *   provider?: ?value-of<AiProvider>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->available = $values['available'];
        $this->dailyLimit = $values['dailyLimit'];
        $this->paymentMethodRequired = $values['paymentMethodRequired'];
        $this->provider = $values['provider'] ?? null;
        $this->remaining = $values['remaining'];
        $this->sandbox = $values['sandbox'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
