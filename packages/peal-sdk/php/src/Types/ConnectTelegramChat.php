<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class ConnectTelegramChat extends JsonSerializableType
{
    /**
     * @var string $botToken
     */
    #[JsonProperty('botToken')]
    public string $botToken;

    /**
     * @var string $chat
     */
    #[JsonProperty('chat')]
    public string $chat;

    /**
     * @var ?string $channelId
     */
    #[JsonProperty('channelId')]
    public ?string $channelId;

    /**
     * @param array{
     *   botToken: string,
     *   chat: string,
     *   channelId?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->botToken = $values['botToken'];
        $this->chat = $values['chat'];
        $this->channelId = $values['channelId'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
