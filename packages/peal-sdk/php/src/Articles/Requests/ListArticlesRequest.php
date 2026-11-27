<?php

namespace Peal\Articles\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\ArticleStateName;

class ListArticlesRequest extends JsonSerializableType
{
    /**
     * @var ?string $cursor
     */
    public ?string $cursor;

    /**
     * @var ?string $from
     */
    public ?string $from;

    /**
     * @var ?string $limit
     */
    public ?string $limit;

    /**
     * @var ?value-of<ArticleStateName> $status
     */
    public ?string $status;

    /**
     * @var ?string $to
     */
    public ?string $to;

    /**
     * @param array{
     *   cursor?: ?string,
     *   from?: ?string,
     *   limit?: ?string,
     *   status?: ?value-of<ArticleStateName>,
     *   to?: ?string,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->cursor = $values['cursor'] ?? null;
        $this->from = $values['from'] ?? null;
        $this->limit = $values['limit'] ?? null;
        $this->status = $values['status'] ?? null;
        $this->to = $values['to'] ?? null;
    }
}
