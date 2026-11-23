<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class ApiKeysAtStakeRoles extends JsonSerializableType
{
    /**
     * @var int $admin
     */
    #[JsonProperty('admin')]
    public int $admin;

    /**
     * @var int $contributor
     */
    #[JsonProperty('contributor')]
    public int $contributor;

    /**
     * @var int $editor
     */
    #[JsonProperty('editor')]
    public int $editor;

    /**
     * @var int $owner
     */
    #[JsonProperty('owner')]
    public int $owner;

    /**
     * @var int $viewer
     */
    #[JsonProperty('viewer')]
    public int $viewer;

    /**
     * @param array{
     *   admin: int,
     *   contributor: int,
     *   editor: int,
     *   owner: int,
     *   viewer: int,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->admin = $values['admin'];
        $this->contributor = $values['contributor'];
        $this->editor = $values['editor'];
        $this->owner = $values['owner'];
        $this->viewer = $values['viewer'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
