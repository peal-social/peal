<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class NoticeEventVideoGenerationEnded extends JsonSerializableType
{
    /**
     * @var string $generationId
     */
    #[JsonProperty('generationId')]
    public string $generationId;

    /**
     * @var ?string $mediaId
     */
    #[JsonProperty('mediaId')]
    public ?string $mediaId;

    /**
     * @var value-of<NoticeEventVideoGenerationEndedOutcome> $outcome
     */
    #[JsonProperty('outcome')]
    public string $outcome;

    /**
     * @var ?value-of<VideoFailureReason> $reason
     */
    #[JsonProperty('reason')]
    public ?string $reason;

    /**
     * @param array{
     *   generationId: string,
     *   outcome: value-of<NoticeEventVideoGenerationEndedOutcome>,
     *   mediaId?: ?string,
     *   reason?: ?value-of<VideoFailureReason>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->generationId = $values['generationId'];
        $this->mediaId = $values['mediaId'] ?? null;
        $this->outcome = $values['outcome'];
        $this->reason = $values['reason'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
