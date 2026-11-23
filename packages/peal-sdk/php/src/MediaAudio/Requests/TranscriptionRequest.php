<?php

namespace Peal\MediaAudio\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class TranscriptionRequest extends JsonSerializableType
{
    /**
     * @var ?bool $saveAsDescription
     */
    #[JsonProperty('saveAsDescription')]
    public ?bool $saveAsDescription;

    /**
     * @param array{
     *   saveAsDescription?: ?bool,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->saveAsDescription = $values['saveAsDescription'] ?? null;
    }
}
