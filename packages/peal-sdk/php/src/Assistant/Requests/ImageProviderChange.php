<?php

namespace Peal\Assistant\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Types\AiImageProvider;

class ImageProviderChange extends JsonSerializableType
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
     * @var string $model
     */
    #[JsonProperty('model')]
    public string $model;

    /**
     * @var ?value-of<AiImageProvider> $provider
     */
    #[JsonProperty('provider')]
    public ?string $provider;

    /**
     * @param array{
     *   model: string,
     *   apiKey?: ?string,
     *   baseUrl?: ?string,
     *   provider?: ?value-of<AiImageProvider>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->apiKey = $values['apiKey'] ?? null;
        $this->baseUrl = $values['baseUrl'] ?? null;
        $this->model = $values['model'];
        $this->provider = $values['provider'] ?? null;
    }
}
