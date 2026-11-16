<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

/**
 * How a post goes out on a Slack channel, on every part of a thread. Scheduling needs none of them.
 */
class SlackOptions extends JsonSerializableType
{
    /**
     * @var ?bool $unfurlLinks
     */
    #[JsonProperty('unfurlLinks')]
    public ?bool $unfurlLinks;

    /**
     * @param array{
     *   unfurlLinks?: ?bool,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->unfurlLinks = $values['unfurlLinks'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
