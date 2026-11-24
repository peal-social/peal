<?php

namespace Peal\Partner\Account\Requests;

use Peal\Core\Json\JsonSerializableType;

class OverviewAccountRequest extends JsonSerializableType
{
    /**
     * @var ?string $before
     */
    public ?string $before;

    /**
     * @var ?string $limit
     */
    public ?string $limit;

    /**
     * @param array{
     *   before?: ?string,
     *   limit?: ?string,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->before = $values['before'] ?? null;
        $this->limit = $values['limit'] ?? null;
    }
}
