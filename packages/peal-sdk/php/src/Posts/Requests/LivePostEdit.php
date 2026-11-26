<?php

namespace Peal\Posts\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\RichText;
use Peal\Core\Json\JsonProperty;
use Peal\Types\TargetOptions;

class LivePostEdit extends JsonSerializableType
{
    /**
     * @var ?string $wait
     */
    public ?string $wait;

    /**
     * @var ?RichText $body
     */
    #[JsonProperty('body')]
    public ?RichText $body;

    /**
     * @var ?string $bodyMarkdown
     */
    #[JsonProperty('bodyMarkdown')]
    public ?string $bodyMarkdown;

    /**
     * @var ?TargetOptions $options
     */
    #[JsonProperty('options')]
    public ?TargetOptions $options;

    /**
     * @var ?int $part
     */
    #[JsonProperty('part')]
    public ?int $part;

    /**
     * @var ?string $text
     */
    #[JsonProperty('text')]
    public ?string $text;

    /**
     * @param array{
     *   wait?: ?string,
     *   body?: ?RichText,
     *   bodyMarkdown?: ?string,
     *   options?: ?TargetOptions,
     *   part?: ?int,
     *   text?: ?string,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->wait = $values['wait'] ?? null;
        $this->body = $values['body'] ?? null;
        $this->bodyMarkdown = $values['bodyMarkdown'] ?? null;
        $this->options = $values['options'] ?? null;
        $this->part = $values['part'] ?? null;
        $this->text = $values['text'] ?? null;
    }
}
