<?php

namespace Peal\Channels\Sets\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\ChannelSetDetails;

class UpdateSetsRequest extends JsonSerializableType
{
    /**
     * @var ChannelSetDetails $body
     */
    public ChannelSetDetails $body;

    /**
     * @param array{
     *   body: ChannelSetDetails,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->body = $values['body'];
    }
}
