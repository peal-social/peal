<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class MediaCapabilities extends JsonSerializableType
{
    /**
     * @var MediaCapabilitiesAltText $altText
     */
    #[JsonProperty('altText')]
    public MediaCapabilitiesAltText $altText;

    /**
     * @var ?array<MediaFormat> $formats
     */
    #[JsonProperty('formats'), ArrayType([MediaFormat::class])]
    public ?array $formats;

    /**
     * @var int $maxCount
     */
    #[JsonProperty('maxCount')]
    public int $maxCount;

    /**
     * @var ?int $maxTotalByteSize
     */
    #[JsonProperty('maxTotalByteSize')]
    public ?int $maxTotalByteSize;

    /**
     * @var ?int $maxVideos
     */
    #[JsonProperty('maxVideos')]
    public ?int $maxVideos;

    /**
     * @var ?bool $mixesKinds
     */
    #[JsonProperty('mixesKinds')]
    public ?bool $mixesKinds;

    /**
     * @var bool $required
     */
    #[JsonProperty('required')]
    public bool $required;

    /**
     * @param array{
     *   altText: MediaCapabilitiesAltText,
     *   maxCount: int,
     *   required: bool,
     *   formats?: ?array<MediaFormat>,
     *   maxTotalByteSize?: ?int,
     *   maxVideos?: ?int,
     *   mixesKinds?: ?bool,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->altText = $values['altText'];
        $this->formats = $values['formats'] ?? null;
        $this->maxCount = $values['maxCount'];
        $this->maxTotalByteSize = $values['maxTotalByteSize'] ?? null;
        $this->maxVideos = $values['maxVideos'] ?? null;
        $this->mixesKinds = $values['mixesKinds'] ?? null;
        $this->required = $values['required'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
