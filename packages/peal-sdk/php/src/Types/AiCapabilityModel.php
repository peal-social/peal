<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class AiCapabilityModel extends JsonSerializableType
{
    /**
     * @var value-of<AiCapability> $capability
     */
    #[JsonProperty('capability')]
    public string $capability;

    /**
     * @var ?string $model
     */
    #[JsonProperty('model')]
    public ?string $model;

    /**
     * @var ?value-of<AiProvider> $provider
     */
    #[JsonProperty('provider')]
    public ?string $provider;

    /**
     * @var bool $serverModel
     */
    #[JsonProperty('serverModel')]
    public bool $serverModel;

    /**
     * @var ?string $updatedAt
     */
    #[JsonProperty('updatedAt')]
    public ?string $updatedAt;

    /**
     * @param array{
     *   capability: value-of<AiCapability>,
     *   serverModel: bool,
     *   model?: ?string,
     *   provider?: ?value-of<AiProvider>,
     *   updatedAt?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->capability = $values['capability'];
        $this->model = $values['model'] ?? null;
        $this->provider = $values['provider'] ?? null;
        $this->serverModel = $values['serverModel'];
        $this->updatedAt = $values['updatedAt'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
