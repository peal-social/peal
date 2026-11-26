<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class BodyProblem extends JsonSerializableType
{
    /**
     * @var ?int $column
     */
    #[JsonProperty('column')]
    public ?int $column;

    /**
     * @var ?int $line
     */
    #[JsonProperty('line')]
    public ?int $line;

    /**
     * @var value-of<BodyProblemKind> $problem
     */
    #[JsonProperty('problem')]
    public string $problem;

    /**
     * @param array{
     *   problem: value-of<BodyProblemKind>,
     *   column?: ?int,
     *   line?: ?int,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->column = $values['column'] ?? null;
        $this->line = $values['line'] ?? null;
        $this->problem = $values['problem'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
