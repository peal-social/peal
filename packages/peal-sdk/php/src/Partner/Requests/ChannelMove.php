<?php

namespace Peal\Partner\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class ChannelMove extends JsonSerializableType
{
    /**
     * @var ?string $idempotencyKey
     */
    public ?string $idempotencyKey;

    /**
     * @var string $toWorkspaceId
     */
    #[JsonProperty('toWorkspaceId')]
    public string $toWorkspaceId;

    /**
     * @param array{
     *   toWorkspaceId: string,
     *   idempotencyKey?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->idempotencyKey = $values['idempotencyKey'] ?? null;
        $this->toWorkspaceId = $values['toWorkspaceId'];
    }
}
