<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class MovedChannel extends JsonSerializableType
{
    /**
     * @var Channel $channel
     */
    #[JsonProperty('channel')]
    public Channel $channel;

    /**
     * @var int $postsLeft
     */
    #[JsonProperty('postsLeft')]
    public int $postsLeft;

    /**
     * @param array{
     *   channel: Channel,
     *   postsLeft: int,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->channel = $values['channel'];
        $this->postsLeft = $values['postsLeft'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
