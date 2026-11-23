<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class Me extends JsonSerializableType
{
    /**
     * @var ?BrowserAnalytics $browserAnalytics
     */
    #[JsonProperty('browserAnalytics')]
    public ?BrowserAnalytics $browserAnalytics;

    /**
     * @var ?string $impersonatedBy
     */
    #[JsonProperty('impersonatedBy')]
    public ?string $impersonatedBy;

    /**
     * @var ?MeSupportChat $supportChat
     */
    #[JsonProperty('supportChat')]
    public ?MeSupportChat $supportChat;

    /**
     * @var MeUser $user
     */
    #[JsonProperty('user')]
    public MeUser $user;

    /**
     * @var array<Membership> $workspaces
     */
    #[JsonProperty('workspaces'), ArrayType([Membership::class])]
    public array $workspaces;

    /**
     * @param array{
     *   user: MeUser,
     *   workspaces: array<Membership>,
     *   browserAnalytics?: ?BrowserAnalytics,
     *   impersonatedBy?: ?string,
     *   supportChat?: ?MeSupportChat,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->browserAnalytics = $values['browserAnalytics'] ?? null;
        $this->impersonatedBy = $values['impersonatedBy'] ?? null;
        $this->supportChat = $values['supportChat'] ?? null;
        $this->user = $values['user'];
        $this->workspaces = $values['workspaces'];
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
