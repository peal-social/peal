<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class AssistantActionShorten extends JsonSerializableType
{
    /**
     * @var ?bool $media
     */
    #[JsonProperty('media')]
    public ?bool $media;

    /**
     * @var value-of<Platform> $platform
     */
    #[JsonProperty('platform')]
    public string $platform;

    /**
     * @param array{
     *   platform: value-of<Platform>,
     *   media?: ?bool,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->media = $values['media'] ?? null;
        $this->platform = $values['platform'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
