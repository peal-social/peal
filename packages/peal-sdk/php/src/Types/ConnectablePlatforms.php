<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Peal\Core\Json\JsonProperty;
use Peal\Core\Types\ArrayType;

class ConnectablePlatforms extends JsonSerializableType
{
    /**
     * @var array<value-of<InstagramConnection>> $instagramConnections
     */
    #[JsonProperty('instagramConnections'), ArrayType(['string'])]
    public array $instagramConnections;

    /**
     * @var array<value-of<LinkedInConnection>> $linkedinConnections
     */
    #[JsonProperty('linkedinConnections'), ArrayType(['string'])]
    public array $linkedinConnections;

    /**
     * @var array<value-of<Platform>> $platforms
     */
    #[JsonProperty('platforms'), ArrayType(['string'])]
    public array $platforms;

    /**
     * @var ?array<value-of<ChatPlatform>> $chats
     */
    #[JsonProperty('chats'), ArrayType(['string'])]
    public ?array $chats;

    /**
     * @var ?array<value-of<SitePlatform>> $sites
     */
    #[JsonProperty('sites'), ArrayType(['string'])]
    public ?array $sites;

    /**
     * @param array{
     *   instagramConnections: array<value-of<InstagramConnection>>,
     *   linkedinConnections: array<value-of<LinkedInConnection>>,
     *   platforms: array<value-of<Platform>>,
     *   chats?: ?array<value-of<ChatPlatform>>,
     *   sites?: ?array<value-of<SitePlatform>>,
     * } $values
     */
    public function __construct(
        array $values,
    ) {
        $this->instagramConnections = $values['instagramConnections'];
        $this->linkedinConnections = $values['linkedinConnections'];
        $this->platforms = $values['platforms'];
        $this->chats = $values['chats'] ?? null;
        $this->sites = $values['sites'] ?? null;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }
}
