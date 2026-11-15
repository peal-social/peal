<?php

namespace Peal\Channels\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Types\KeySitePlatform;

class ConnectSiteWithKey extends JsonSerializableType
{
    /**
     * @var string $apiKey
     */
    #[JsonProperty('apiKey')]
    public string $apiKey;

    /**
     * @var value-of<KeySitePlatform> $platform
     */
    #[JsonProperty('platform')]
    public string $platform;

    /**
     * @var ?string $publication
     */
    #[JsonProperty('publication')]
    public ?string $publication;

    /**
     * @param array{
     *   apiKey: string,
     *   platform: value-of<KeySitePlatform>,
     *   publication?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->apiKey = $values['apiKey'];
        $this->platform = $values['platform'];
        $this->publication = $values['publication'] ?? null;
    }
}
