<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class ContentViolationBodyInvalid extends JsonSerializableType
{
    /**
     * @var string $channelId
     */
    #[JsonProperty('channelId')]
    public string $channelId;

    /**
     * @var ?int $part
     */
    #[JsonProperty('part')]
    public ?int $part;

    /**
     * @param array{
     *   channelId: string,
     *   part?: ?int,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->channelId = $values['channelId'];
        $this->part = $values['part'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
