<?php

namespace Peal\InboxMessages\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class ConfirmPrivateReplyInboxMessagesRequest extends JsonSerializableType
{
    /**
     * @var bool $went
     */
    #[JsonProperty('went')]
    public bool $went;

    /**
     * @param array{
     *   went: bool,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->went = $values['went'];
    }
}
