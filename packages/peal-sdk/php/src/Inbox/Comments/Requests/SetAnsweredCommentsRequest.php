<?php

namespace Peal\Inbox\Comments\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class SetAnsweredCommentsRequest extends JsonSerializableType
{
    /**
     * @var bool $answered
     */
    #[JsonProperty('answered')]
    public bool $answered;

    /**
     * @param array{
     *   answered: bool,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->answered = $values['answered'];
    }
}
