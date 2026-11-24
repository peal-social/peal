<?php

namespace Peal\Inbox\Messages\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Inbox\Messages\Types\ListConversationsMessagesRequestUnread;

class ListConversationsMessagesRequest extends JsonSerializableType
{
    /**
     * @var ?string $channelId
     */
    public ?string $channelId;

    /**
     * @var ?string $cursor
     */
    public ?string $cursor;

    /**
     * @var ?string $limit
     */
    public ?string $limit;

    /**
     * @var ?value-of<ListConversationsMessagesRequestUnread> $unread
     */
    public ?string $unread;

    /**
     * @param array{
     *   channelId?: ?string,
     *   cursor?: ?string,
     *   limit?: ?string,
     *   unread?: ?value-of<ListConversationsMessagesRequestUnread>,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->channelId = $values['channelId'] ?? null;
        $this->cursor = $values['cursor'] ?? null;
        $this->limit = $values['limit'] ?? null;
        $this->unread = $values['unread'] ?? null;
    }
}
