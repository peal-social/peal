<?php

namespace Peal\Media\Slideshows\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\SlideshowStatus;

class ListSlideshowsRequest extends JsonSerializableType
{
    /**
     * @var ?value-of<SlideshowStatus> $status
     */
    public ?string $status;

    /**
     * @param array{
     *   status?: ?value-of<SlideshowStatus>,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->status = $values['status'] ?? null;
    }
}
