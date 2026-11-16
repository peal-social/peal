<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class InboxReplyWindow extends JsonSerializableType
{
    /**
     * @var ?string $closesAt
     */
    #[JsonProperty('closesAt')]
    public ?string $closesAt;

    /**
     * @var bool $open
     */
    #[JsonProperty('open')]
    public bool $open;

    /**
     * @var ?string $personClosesAt
     */
    #[JsonProperty('personClosesAt')]
    public ?string $personClosesAt;

    /**
     * @param array{
     *   open: bool,
     *   closesAt?: ?string,
     *   personClosesAt?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->closesAt = $values['closesAt'] ?? null;
        $this->open = $values['open'];
        $this->personClosesAt = $values['personClosesAt'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
