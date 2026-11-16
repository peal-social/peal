<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

/**
 * How a post goes out on a Discord channel, on every part of a thread. Scheduling needs none of them; a forum channel needs a thread name.
 */
class DiscordOptions extends JsonSerializableType
{
    /**
     * @var ?bool $mentions
     */
    #[JsonProperty('mentions')]
    public ?bool $mentions;

    /**
     * @var ?bool $silent
     */
    #[JsonProperty('silent')]
    public ?bool $silent;

    /**
     * @var ?bool $suppressEmbeds
     */
    #[JsonProperty('suppressEmbeds')]
    public ?bool $suppressEmbeds;

    /**
     * @var ?string $threadName
     */
    #[JsonProperty('threadName')]
    public ?string $threadName;

    /**
     * @param array{
     *   mentions?: ?bool,
     *   silent?: ?bool,
     *   suppressEmbeds?: ?bool,
     *   threadName?: ?string,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->mentions = $values['mentions'] ?? null;
        $this->silent = $values['silent'] ?? null;
        $this->suppressEmbeds = $values['suppressEmbeds'] ?? null;
        $this->threadName = $values['threadName'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
