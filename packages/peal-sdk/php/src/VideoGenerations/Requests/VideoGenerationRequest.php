<?php

namespace Peal\VideoGenerations\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\ImageAspect;
use Peal\Core\Json\JsonProperty;

class VideoGenerationRequest extends JsonSerializableType
{
    /**
     * @var value-of<ImageAspect> $aspect
     */
    #[JsonProperty('aspect')]
    public string $aspect;

    /**
     * @var ?int $durationSeconds
     */
    #[JsonProperty('durationSeconds')]
    public ?int $durationSeconds;

    /**
     * @var ?string $imageMediaId
     */
    #[JsonProperty('imageMediaId')]
    public ?string $imageMediaId;

    /**
     * @var string $prompt
     */
    #[JsonProperty('prompt')]
    public string $prompt;

    /**
     * @param array{
     *   aspect: value-of<ImageAspect>,
     *   prompt: string,
     *   durationSeconds?: ?int,
     *   imageMediaId?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->aspect = $values['aspect'];
        $this->durationSeconds = $values['durationSeconds'] ?? null;
        $this->imageMediaId = $values['imageMediaId'] ?? null;
        $this->prompt = $values['prompt'];
    }
}
