<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class ApiKeysAtStake extends JsonSerializableType
{
    /**
     * @var int $removal
     */
    #[JsonProperty('removal')]
    public int $removal;

    /**
     * @var ApiKeysAtStakeRoles $roles
     */
    #[JsonProperty('roles')]
    public ApiKeysAtStakeRoles $roles;

    /**
     * @param array{
     *   removal: int,
     *   roles: ApiKeysAtStakeRoles,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->removal = $values['removal'];
        $this->roles = $values['roles'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
