<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class NoticeEventSlideshowEnded extends JsonSerializableType
{
    /**
     * @var ?string $mediaId
     */
    #[JsonProperty('mediaId')]
    public ?string $mediaId;

    /**
     * @var value-of<NoticeEventSlideshowEndedOutcome> $outcome
     */
    #[JsonProperty('outcome')]
    public string $outcome;

    /**
     * @var ?value-of<SlideshowFailureReason> $reason
     */
    #[JsonProperty('reason')]
    public ?string $reason;

    /**
     * @var string $slideshowId
     */
    #[JsonProperty('slideshowId')]
    public string $slideshowId;

    /**
     * @param array{
     *   outcome: value-of<NoticeEventSlideshowEndedOutcome>,
     *   slideshowId: string,
     *   mediaId?: ?string,
     *   reason?: ?value-of<SlideshowFailureReason>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->mediaId = $values['mediaId'] ?? null;
        $this->outcome = $values['outcome'];
        $this->reason = $values['reason'] ?? null;
        $this->slideshowId = $values['slideshowId'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
