<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class PlatformFollowUps extends JsonSerializableType
{
    /**
     * @var value-of<PlatformFollowUpComment> $comment
     */
    #[JsonProperty('comment')]
    public string $comment;

    /**
     * @var value-of<Platform> $platform
     */
    #[JsonProperty('platform')]
    public string $platform;

    /**
     * @var value-of<PlatformFollowUpRepost> $repost
     */
    #[JsonProperty('repost')]
    public string $repost;

    /**
     * @param array{
     *   comment: value-of<PlatformFollowUpComment>,
     *   platform: value-of<Platform>,
     *   repost: value-of<PlatformFollowUpRepost>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->comment = $values['comment'];
        $this->platform = $values['platform'];
        $this->repost = $values['repost'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
