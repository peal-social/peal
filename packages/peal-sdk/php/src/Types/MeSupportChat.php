<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class MeSupportChat extends JsonSerializableType
{
    /**
     * @var string $emailSignature
     */
    #[JsonProperty('emailSignature')]
    public string $emailSignature;

    /**
     * @param array{
     *   emailSignature: string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->emailSignature = $values['emailSignature'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
