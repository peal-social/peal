<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

/**
 * What Peal reads and does on an ad account, as its network allows: a client hides what is false (the ads list, boosting and spending, reach, results).
 */
class AdAccountCapabilities extends JsonSerializableType
{
    /**
     * @var bool $ads
     */
    #[JsonProperty('ads')]
    public bool $ads;

    /**
     * @var bool $boosts
     */
    #[JsonProperty('boosts')]
    public bool $boosts;

    /**
     * @var bool $reach
     */
    #[JsonProperty('reach')]
    public bool $reach;

    /**
     * @var bool $results
     */
    #[JsonProperty('results')]
    public bool $results;

    /**
     * @param array{
     *   ads: bool,
     *   boosts: bool,
     *   reach: bool,
     *   results: bool,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->ads = $values['ads'];
        $this->boosts = $values['boosts'];
        $this->reach = $values['reach'];
        $this->results = $values['results'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
