<?php

namespace Peal\Inbox\Comments\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Inbox\Comments\Types\ListThreadsCommentsRequestUnanswered;

class ListThreadsCommentsRequest extends JsonSerializableType
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
     * @var ?string $postId
     */
    public ?string $postId;

    /**
     * @var ?value-of<ListThreadsCommentsRequestUnanswered> $unanswered
     */
    public ?string $unanswered;

    /**
     * @param array{
     *   channelId?: ?string,
     *   cursor?: ?string,
     *   limit?: ?string,
     *   postId?: ?string,
     *   unanswered?: ?value-of<ListThreadsCommentsRequestUnanswered>,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->channelId = $values['channelId'] ?? null;
        $this->cursor = $values['cursor'] ?? null;
        $this->limit = $values['limit'] ?? null;
        $this->postId = $values['postId'] ?? null;
        $this->unanswered = $values['unanswered'] ?? null;
    }
}
