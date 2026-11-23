<?php

namespace Peal\Assistant\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Types\TextProviderKind;
use Peal\Types\AiProvider;

class TextProviderChange extends JsonSerializableType
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
     * @var ?value-of<TextProviderKind> $kind
     */
    #[JsonProperty('kind')]
    public ?string $kind;

    /**
     * @var string $model
     */
    #[JsonProperty('model')]
    public string $model;

    /**
     * @var ?value-of<AiProvider> $provider
     */
    #[JsonProperty('provider')]
    public ?string $provider;

    /**
     * @param array{
     *   model: string,
     *   apiKey?: ?string,
     *   baseUrl?: ?string,
     *   kind?: ?value-of<TextProviderKind>,
     *   provider?: ?value-of<AiProvider>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->apiKey = $values['apiKey'] ?? null;
        $this->baseUrl = $values['baseUrl'] ?? null;
        $this->kind = $values['kind'] ?? null;
        $this->model = $values['model'];
        $this->provider = $values['provider'] ?? null;
    }
}
