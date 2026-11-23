<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class VideoGeneration extends JsonSerializableType
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
     * @var ?int $durationSeconds
     */
    #[JsonProperty('durationSeconds')]
    public ?int $durationSeconds;

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
     * @var ?string $imageMediaId
     */
    #[JsonProperty('imageMediaId')]
    public ?string $imageMediaId;

    /**
     * @var ?string $mediaId
     */
    #[JsonProperty('mediaId')]
    public ?string $mediaId;

    /**
     * @var ?value-of<VideoFailureReason> $reason
     */
    #[JsonProperty('reason')]
    public ?string $reason;

    /**
     * @var ?string $startedAt
     */
    #[JsonProperty('startedAt')]
    public ?string $startedAt;

    /**
     * @var value-of<VideoGenerationStatus> $status
     */
    #[JsonProperty('status')]
    public string $status;

    /**
     * @param array{
     *   aspect: value-of<ImageAspect>,
     *   createdAt: string,
     *   id: string,
     *   status: value-of<VideoGenerationStatus>,
     *   durationSeconds?: ?int,
     *   finishedAt?: ?string,
     *   imageMediaId?: ?string,
     *   mediaId?: ?string,
     *   reason?: ?value-of<VideoFailureReason>,
     *   startedAt?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->aspect = $values['aspect'];
        $this->createdAt = $values['createdAt'];
        $this->durationSeconds = $values['durationSeconds'] ?? null;
        $this->finishedAt = $values['finishedAt'] ?? null;
        $this->id = $values['id'];
        $this->imageMediaId = $values['imageMediaId'] ?? null;
        $this->mediaId = $values['mediaId'] ?? null;
        $this->reason = $values['reason'] ?? null;
        $this->startedAt = $values['startedAt'] ?? null;
        $this->status = $values['status'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
