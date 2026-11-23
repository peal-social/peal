<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class AssistantVideosStatus extends JsonSerializableType
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
     * @var int $maxPromptLength
     */
    #[JsonProperty('maxPromptLength')]
    public int $maxPromptLength;

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
     * @param array{
     *   available: bool,
     *   dailyLimit: int,
     *   maxPromptLength: int,
     *   remaining: int,
     *   provider?: ?value-of<AiProvider>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->available = $values['available'];
        $this->dailyLimit = $values['dailyLimit'];
        $this->maxPromptLength = $values['maxPromptLength'];
        $this->provider = $values['provider'] ?? null;
        $this->remaining = $values['remaining'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
