<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class AssistantActionWrite extends JsonSerializableType
{
    /**
     * @var ?value-of<TranslationLanguage> $language
     */
    #[JsonProperty('language')]
    public ?string $language;

    /**
     * @var ?bool $media
     */
    #[JsonProperty('media')]
    public ?bool $media;

    /**
     * @var ?value-of<Platform> $platform
     */
    #[JsonProperty('platform')]
    public ?string $platform;

    /**
     * @var ?value-of<AssistantTone> $tone
     */
    #[JsonProperty('tone')]
    public ?string $tone;

    /**
     * @param array{
     *   language?: ?value-of<TranslationLanguage>,
     *   media?: ?bool,
     *   platform?: ?value-of<Platform>,
     *   tone?: ?value-of<AssistantTone>,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->language = $values['language'] ?? null;
        $this->media = $values['media'] ?? null;
        $this->platform = $values['platform'] ?? null;
        $this->tone = $values['tone'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
