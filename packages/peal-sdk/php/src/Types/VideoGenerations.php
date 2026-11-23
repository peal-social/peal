<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class VideoGenerations extends JsonSerializableType
{
    /**
     * @var array<VideoGeneration> $generations
     */
    #[JsonProperty('generations'), ArrayType([VideoGeneration::class])]
    public array $generations;

    /**
     * @param array{
     *   generations: array<VideoGeneration>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->generations = $values['generations'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
