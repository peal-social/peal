<?php

namespace Peal\Slideshows\Requests;

use Peal\Core\Json\JsonSerializableType;
use Peal\Types\ImageAspect;
use Peal\Core\Json\JsonProperty;
use Peal\Types\Slide;
use Peal\Core\Types\ArrayType;
use Peal\Types\SlideTransition;

class SlideshowRequest extends JsonSerializableType
{
    /**
     * @var value-of<ImageAspect> $aspect
     */
    #[JsonProperty('aspect')]
    public string $aspect;

    /**
     * @var ?int $secondsPerSlide
     */
    #[JsonProperty('secondsPerSlide')]
    public ?int $secondsPerSlide;

    /**
     * @var array<Slide> $slides
     */
    #[JsonProperty('slides'), ArrayType([Slide::class])]
    public array $slides;

    /**
     * @var ?value-of<SlideTransition> $transition
     */
    #[JsonProperty('transition')]
    public ?string $transition;

    /**
     * @var ?string $voiceoverMediaId
     */
    #[JsonProperty('voiceoverMediaId')]
    public ?string $voiceoverMediaId;

    /**
     * @param array{
     *   aspect: value-of<ImageAspect>,
     *   slides: array<Slide>,
     *   secondsPerSlide?: ?int,
     *   transition?: ?value-of<SlideTransition>,
     *   voiceoverMediaId?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->aspect = $values['aspect'];
        $this->secondsPerSlide = $values['secondsPerSlide'] ?? null;
        $this->slides = $values['slides'];
        $this->transition = $values['transition'] ?? null;
        $this->voiceoverMediaId = $values['voiceoverMediaId'] ?? null;
    }
}
