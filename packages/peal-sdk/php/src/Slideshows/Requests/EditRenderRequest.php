<?php

namespace Peal\Slideshows\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class EditRenderRequest extends JsonSerializableType
{
    /**
     * @var array<string, mixed> $edit
     */
    #[JsonProperty('edit'), ArrayType(['string' => 'mixed'])]
    public array $edit;

    /**
     * @param array{
     *   edit: array<string, mixed>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->edit = $values['edit'];
    }
}
