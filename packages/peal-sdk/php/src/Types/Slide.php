<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class Slide extends JsonSerializableType
{
    /**
     * @var ?string $caption
     */
    #[JsonProperty('caption')]
    public ?string $caption;

    /**
     * @var string $mediaId
     */
    #[JsonProperty('mediaId')]
    public string $mediaId;

    /**
     * @var ?value-of<SlideMotion> $motion
     */
    #[JsonProperty('motion')]
    public ?string $motion;

    /**
     * @param array{
     *   mediaId: string,
     *   caption?: ?string,
     *   motion?: ?value-of<SlideMotion>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->caption = $values['caption'] ?? null;
        $this->mediaId = $values['mediaId'];
        $this->motion = $values['motion'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
