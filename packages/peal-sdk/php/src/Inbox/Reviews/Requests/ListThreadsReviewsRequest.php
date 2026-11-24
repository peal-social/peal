<?php

namespace Peal\Inbox\Reviews\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Inbox\Reviews\Types\ListThreadsReviewsRequestUnanswered;

class ListThreadsReviewsRequest extends JsonSerializableType
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
     * @var ?value-of<ListThreadsReviewsRequestUnanswered> $unanswered
     */
    public ?string $unanswered;

    /**
     * @param array{
     *   channelId?: ?string,
     *   cursor?: ?string,
     *   limit?: ?string,
     *   unanswered?: ?value-of<ListThreadsReviewsRequestUnanswered>,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->channelId = $values['channelId'] ?? null;
        $this->cursor = $values['cursor'] ?? null;
        $this->limit = $values['limit'] ?? null;
        $this->unanswered = $values['unanswered'] ?? null;
    }
}
