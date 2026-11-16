<?php

namespace Peal\Channels\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\ConnectChat;

class ConnectChatChannelsRequest extends JsonSerializableType
{
    /**
     * @var ConnectChat $body
     */
    public ConnectChat $body;

    /**
     * @param array{
     *   body: ConnectChat,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->body = $values['body'];
    }
}
