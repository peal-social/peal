<?php

namespace Peal\Media\Videos\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\VideoGenerationStatus;

class ListVideosRequest extends JsonSerializableType
{
    /**
     * @var ?value-of<VideoGenerationStatus> $status
     */
    public ?string $status;

    /**
     * @param array{
     *   status?: ?value-of<VideoGenerationStatus>,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->status = $values['status'] ?? null;
    }
}
