<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class WorkspaceSecurity extends JsonSerializableType
{
    /**
     * @var ?int $membersWithoutTwoStep
     */
    #[JsonProperty('membersWithoutTwoStep')]
    public ?int $membersWithoutTwoStep;

    /**
     * @var bool $twoStepRequired
     */
    #[JsonProperty('twoStepRequired')]
    public bool $twoStepRequired;

    /**
     * @param array{
     *   twoStepRequired: bool,
     *   membersWithoutTwoStep?: ?int,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->membersWithoutTwoStep = $values['membersWithoutTwoStep'] ?? null;
        $this->twoStepRequired = $values['twoStepRequired'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
