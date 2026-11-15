<?php

namespace Peal\Channels\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class StartSiteSignIn extends JsonSerializableType
{
    /**
     * @var ?string $channelId
     */
    #[JsonProperty('channelId')]
    public ?string $channelId;

    /**
     * @param array{
     *   channelId?: ?string,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->channelId = $values['channelId'] ?? null;
    }
}
