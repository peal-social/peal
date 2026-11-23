<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class AiCapabilityModels extends JsonSerializableType
{
    /**
     * @var array<AiCapabilityModel> $models
     */
    #[JsonProperty('models'), ArrayType([AiCapabilityModel::class])]
    public array $models;

    /**
     * @param array{
     *   models: array<AiCapabilityModel>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->models = $values['models'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
