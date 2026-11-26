<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

/**
 * How a post goes out on a Snapchat Public Profile, as a Spotlight. Scheduling needs none of them; `locale` is the Spotlight's language and country, as Snap's `locale` takes them (`en_US`), and `en_US` when left out.
 */
class SnapchatOptions extends JsonSerializableType
{
    /**
     * @var ?string $locale
     */
    #[JsonProperty('locale')]
    public ?string $locale;

    /**
     * @param array{
     *   locale?: ?string,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->locale = $values['locale'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
