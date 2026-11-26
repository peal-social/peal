<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

/**
 * How a post goes out on a site on WordPress.com, as an article. Scheduling needs `title`; `coverMediaId` names an image of the library, the featured image.
 */
class WordPressComOptions extends JsonSerializableType
{
    /**
     * @var ?string $coverMediaId
     */
    #[JsonProperty('coverMediaId')]
    public ?string $coverMediaId;

    /**
     * @var ?string $excerpt
     */
    #[JsonProperty('excerpt')]
    public ?string $excerpt;

    /**
     * @var ?value-of<SiteStatusOption> $siteStatus
     */
    #[JsonProperty('siteStatus')]
    public ?string $siteStatus;

    /**
     * @var ?array<string> $tags
     */
    #[JsonProperty('tags'), ArrayType(['string'])]
    public ?array $tags;

    /**
     * @var ?string $title
     */
    #[JsonProperty('title')]
    public ?string $title;

    /**
     * @var ?array<string> $categories
     */
    #[JsonProperty('categories'), ArrayType(['string'])]
    public ?array $categories;

    /**
     * @param array{
     *   coverMediaId?: ?string,
     *   excerpt?: ?string,
     *   siteStatus?: ?value-of<SiteStatusOption>,
     *   tags?: ?array<string>,
     *   title?: ?string,
     *   categories?: ?array<string>,
     * } $values
     */
    public function __construct(
        array $values = [],
    ) {
        $this->coverMediaId = $values['coverMediaId'] ?? null;
        $this->excerpt = $values['excerpt'] ?? null;
        $this->siteStatus = $values['siteStatus'] ?? null;
        $this->tags = $values['tags'] ?? null;
        $this->title = $values['title'] ?? null;
        $this->categories = $values['categories'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
