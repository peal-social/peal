<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

/**
 * How a post goes out on a Telegram channel or group, on every part of a thread. Scheduling needs none of them.
 */
class TelegramOptions extends JsonSerializableType
{
    /**
     * @var ?bool $linkPreview
     */
    #[JsonProperty('linkPreview')]
    public ?bool $linkPreview;

    /**
     * @var ?bool $silent
     */
    #[JsonProperty('silent')]
    public ?bool $silent;

    /**
     * @param array{
     *   linkPreview?: ?bool,
     *   silent?: ?bool,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->linkPreview = $values['linkPreview'] ?? null;
        $this->silent = $values['silent'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
