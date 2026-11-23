<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class AiProviderConnections extends JsonSerializableType
{
    /**
     * @var array<AiProviderConnection> $providers
     */
    #[JsonProperty('providers'), ArrayType([AiProviderConnection::class])]
    public array $providers;

    /**
     * @param array{
     *   providers: array<AiProviderConnection>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->providers = $values['providers'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
