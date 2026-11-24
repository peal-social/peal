<?php

namespace Peal\Inbox\Messages\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class SetApplicationMessagesRequest extends JsonSerializableType
{
    /**
     * @var bool $allowed
     */
    #[JsonProperty('allowed')]
    public bool $allowed;

    /**
     * @var string $clientId
     */
    #[JsonProperty('clientId')]
    public string $clientId;

    /**
     * @param array{
     *   allowed: bool,
     *   clientId: string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->allowed = $values['allowed'];
        $this->clientId = $values['clientId'];
    }
}
