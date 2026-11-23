<?php

namespace Peal\Assistant\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Types\AiProvider;

class AiCapabilityModelChange extends JsonSerializableType
{
    /**
     * @var ?string $model
     */
    #[JsonProperty('model')]
    public ?string $model;

    /**
     * @var value-of<AiProvider> $provider
     */
    #[JsonProperty('provider')]
    public string $provider;

    /**
     * @param array{
     *   provider: value-of<AiProvider>,
     *   model?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->model = $values['model'] ?? null;
        $this->provider = $values['provider'];
    }
}
