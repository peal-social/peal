<?php

namespace Peal\Inbox\Comments\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\InboxModerationAction;
use Peal\Core\Json\JsonProperty;

class ModerateCommentsRequest extends JsonSerializableType
{
    /**
     * @var value-of<InboxModerationAction> $action
     */
    #[JsonProperty('action')]
    public string $action;

    /**
     * @param array{
     *   action: value-of<InboxModerationAction>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->action = $values['action'];
    }
}
