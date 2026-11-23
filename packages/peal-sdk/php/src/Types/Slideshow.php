<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\Union;
use Peal\Core\Types\ArrayType;

class Slideshow extends JsonSerializableType
{
    /**
     * @var value-of<ImageAspect> $aspect
     */
    #[JsonProperty('aspect')]
    public string $aspect;

    /**
     * @var string $createdAt
     */
    #[JsonProperty('createdAt')]
    public string $createdAt;

    /**
     * @var (
     *    float
     *   |value-of<NonFiniteNumber>
     * ) $durationSeconds
     */
    #[JsonProperty('durationSeconds'), Union('float', 'string')]
    public float|string $durationSeconds;

    /**
     * @var ?string $finishedAt
     */
    #[JsonProperty('finishedAt')]
    public ?string $finishedAt;

    /**
     * @var string $id
     */
    #[JsonProperty('id')]
    public string $id;

    /**
     * @var array<string> $imageMediaIds
     */
    #[JsonProperty('imageMediaIds'), ArrayType(['string'])]
    public array $imageMediaIds;

    /**
     * @var ?string $mediaId
     */
    #[JsonProperty('mediaId')]
    public ?string $mediaId;

    /**
     * @var ?value-of<SlideshowFailureReason> $reason
     */
    #[JsonProperty('reason')]
    public ?string $reason;

    /**
     * @var bool $sandbox
     */
    #[JsonProperty('sandbox')]
    public bool $sandbox;

    /**
     * @var ?string $startedAt
     */
    #[JsonProperty('startedAt')]
    public ?string $startedAt;

    /**
     * @var value-of<SlideshowStatus> $status
     */
    #[JsonProperty('status')]
    public string $status;

    /**
     * @var ?string $voiceoverMediaId
     */
    #[JsonProperty('voiceoverMediaId')]
    public ?string $voiceoverMediaId;

    /**
     * @param array{
     *   aspect: value-of<ImageAspect>,
     *   createdAt: string,
     *   durationSeconds: (
     *    float
     *   |value-of<NonFiniteNumber>
     * ),
     *   id: string,
     *   imageMediaIds: array<string>,
     *   sandbox: bool,
     *   status: value-of<SlideshowStatus>,
     *   finishedAt?: ?string,
     *   mediaId?: ?string,
     *   reason?: ?value-of<SlideshowFailureReason>,
     *   startedAt?: ?string,
     *   voiceoverMediaId?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->aspect = $values['aspect'];
        $this->createdAt = $values['createdAt'];
        $this->durationSeconds = $values['durationSeconds'];
        $this->finishedAt = $values['finishedAt'] ?? null;
        $this->id = $values['id'];
        $this->imageMediaIds = $values['imageMediaIds'];
        $this->mediaId = $values['mediaId'] ?? null;
        $this->reason = $values['reason'] ?? null;
        $this->sandbox = $values['sandbox'];
        $this->startedAt = $values['startedAt'] ?? null;
        $this->status = $values['status'];
        $this->voiceoverMediaId = $values['voiceoverMediaId'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
