<?php

namespace Peal\MediaAudio\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class VoiceoverRequest extends JsonSerializableType
{
    /**
     * @var string $text
     */
    #[JsonProperty('text')]
    public string $text;

    /**
     * @var ?string $voice
     */
    #[JsonProperty('voice')]
    public ?string $voice;

    /**
     * @param array{
     *   text: string,
     *   voice?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->text = $values['text'];
        $this->voice = $values['voice'] ?? null;
    }
}
