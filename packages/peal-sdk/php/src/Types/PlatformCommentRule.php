<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class PlatformCommentRule extends JsonSerializableType
{
    /**
     * @var value-of<Platform> $platform
     */
    #[JsonProperty('platform')]
    public string $platform;

    /**
     * @var value-of<PlatformCommentRulePrivate> $privateReply
     */
    #[JsonProperty('privateReply')]
    public string $privateReply;

    /**
     * @var value-of<PlatformCommentRuleReply> $reply
     */
    #[JsonProperty('reply')]
    public string $reply;

    /**
     * @param array{
     *   platform: value-of<Platform>,
     *   privateReply: value-of<PlatformCommentRulePrivate>,
     *   reply: value-of<PlatformCommentRuleReply>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->platform = $values['platform'];
        $this->privateReply = $values['privateReply'];
        $this->reply = $values['reply'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
