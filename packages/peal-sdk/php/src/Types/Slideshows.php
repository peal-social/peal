<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class Slideshows extends JsonSerializableType
{
    /**
     * @var array<Slideshow> $slideshows
     */
    #[JsonProperty('slideshows'), ArrayType([Slideshow::class])]
    public array $slideshows;

    /**
     * @param array{
     *   slideshows: array<Slideshow>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->slideshows = $values['slideshows'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
