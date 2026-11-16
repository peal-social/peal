<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;

class InboxPrivateReply extends JsonSerializableType
{
    /**
     * @var ?string $authorId
     */
    #[JsonProperty('authorId')]
    public ?string $authorId;

    /**
     * @var string $commentId
     */
    #[JsonProperty('commentId')]
    public string $commentId;

    /**
     * @var string $createdAt
     */
    #[JsonProperty('createdAt')]
    public string $createdAt;

    /**
     * @var string $id
     */
    #[JsonProperty('id')]
    public string $id;

    /**
     * @var ?value-of<InboxPrivateReplyReason> $reason
     */
    #[JsonProperty('reason')]
    public ?string $reason;

    /**
     * @var ?string $ruleId
     */
    #[JsonProperty('ruleId')]
    public ?string $ruleId;

    /**
     * @var ?string $settledAt
     */
    #[JsonProperty('settledAt')]
    public ?string $settledAt;

    /**
     * @var value-of<InboxPrivateReplyStatus> $status
     */
    #[JsonProperty('status')]
    public string $status;

    /**
     * @var string $text
     */
    #[JsonProperty('text')]
    public string $text;

    /**
     * @param array{
     *   commentId: string,
     *   createdAt: string,
     *   id: string,
     *   status: value-of<InboxPrivateReplyStatus>,
     *   text: string,
     *   authorId?: ?string,
     *   reason?: ?value-of<InboxPrivateReplyReason>,
     *   ruleId?: ?string,
     *   settledAt?: ?string,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->authorId = $values['authorId'] ?? null;
        $this->commentId = $values['commentId'];
        $this->createdAt = $values['createdAt'];
        $this->id = $values['id'];
        $this->reason = $values['reason'] ?? null;
        $this->ruleId = $values['ruleId'] ?? null;
        $this->settledAt = $values['settledAt'] ?? null;
        $this->status = $values['status'];
        $this->text = $values['text'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
