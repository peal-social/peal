<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\Union;

class Transcript extends JsonSerializableType
{
    /**
     * @var bool $descriptionSaved
     */
    #[JsonProperty('descriptionSaved')]
    public bool $descriptionSaved;

    /**
     * @var (
     *    float
     *   |value-of<NonFiniteNumber>
     * )|null $durationSeconds
     */
    #[JsonProperty('durationSeconds'), Union('float', 'string', 'null')]
    public float|string|null $durationSeconds;

    /**
     * @var ?string $language
     */
    #[JsonProperty('language')]
    public ?string $language;

    /**
     * @var string $text
     */
    #[JsonProperty('text')]
    public string $text;

    /**
     * @param array{
     *   descriptionSaved: bool,
     *   text: string,
     *   durationSeconds?: (
     *    float
     *   |value-of<NonFiniteNumber>
     * )|null,
     *   language?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->descriptionSaved = $values['descriptionSaved'];
        $this->durationSeconds = $values['durationSeconds'] ?? null;
        $this->language = $values['language'] ?? null;
        $this->text = $values['text'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
