<?php

namespace Peal\Assistant\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class AiProviderConnectionChange extends JsonSerializableType
{
    /**
     * @var ?string $apiKey
     */
    #[JsonProperty('apiKey')]
    public ?string $apiKey;

    /**
     * @var ?string $baseUrl
     */
    #[JsonProperty('baseUrl')]
    public ?string $baseUrl;

    /**
     * @param array{
     *   apiKey?: ?string,
     *   baseUrl?: ?string,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->apiKey = $values['apiKey'] ?? null;
        $this->baseUrl = $values['baseUrl'] ?? null;
    }
}
