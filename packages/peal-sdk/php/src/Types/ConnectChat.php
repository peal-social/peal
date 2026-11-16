<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Exception;

class ConnectChat extends JsonSerializableType
{
    /**
     * @var (
     *    'discord'
     *   |'telegram'
     *   |'_unknown'
     * ) $platform
     */
    public readonly string $platform;

    /**
     * @var (
     *    ConnectDiscordChat
     *   |ConnectTelegramChat
     *   |mixed
     * ) $value
     */
    public readonly mixed $value;

    /**
     * @param array{
     *   platform: (
     *    'discord'
     *   |'telegram'
     *   |'_unknown'
     * ),
     *   value: (
     *    ConnectDiscordChat
     *   |ConnectTelegramChat
     *   |mixed
     * ),
     * } $values
     */
    private function __construct(
        array $values,
    ) {
        $this->platform = $values['platform'];
        $this->value = $values['value'];
    }

    /**
     * @param ConnectDiscordChat $discord
     * @return ConnectChat
     */
    public static function discord(ConnectDiscordChat $discord): ConnectChat
    {
        return new ConnectChat([
            'platform' => 'discord',
            'value' => $discord,
        ]);
    }

    /**
     * @param ConnectTelegramChat $telegram
     * @return ConnectChat
     */
    public static function telegram(ConnectTelegramChat $telegram): ConnectChat
    {
        return new ConnectChat([
            'platform' => 'telegram',
            'value' => $telegram,
        ]);
    }

    /**
     * @return bool
     */
    public function isDiscord(): bool
    {
        return $this->value instanceof ConnectDiscordChat && $this->platform === 'discord';
    }

    /**
     * @return ConnectDiscordChat
     */
    public function asDiscord(): ConnectDiscordChat
    {
        if (!($this->value instanceof ConnectDiscordChat && $this->platform === 'discord')) {
            throw new Exception(
                "Expected discord; got " . $this->platform . " with value of type " . get_debug_type($this->value),
            );
        }

        return $this->value;
    }

    /**
     * @return bool
     */
    public function isTelegram(): bool
    {
        return $this->value instanceof ConnectTelegramChat && $this->platform === 'telegram';
    }

    /**
     * @return ConnectTelegramChat
     */
    public function asTelegram(): ConnectTelegramChat
    {
        if (!($this->value instanceof ConnectTelegramChat && $this->platform === 'telegram')) {
            throw new Exception(
                "Expected telegram; got " . $this->platform . " with value of type " . get_debug_type($this->value),
            );
        }

        return $this->value;
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->toJson();
    }

    /**
     * @return array<mixed>
     */
    public function jsonSerialize(): array
    {
        $result = [];
        $result['platform'] = $this->platform;

        $base = parent::jsonSerialize();
        $result = array_merge($base, $result);

        switch ($this->platform) {
            case 'discord':
                $value = $this->asDiscord()->jsonSerialize();
                $result = array_merge($value, $result);
                break;
            case 'telegram':
                $value = $this->asTelegram()->jsonSerialize();
                $result = array_merge($value, $result);
                break;
            case '_unknown':
            default:
                if (is_null($this->value)) {
                    break;
                }
                if ($this->value instanceof JsonSerializableType) {
                    $value = $this->value->jsonSerialize();
                    $result = array_merge($value, $result);
                } elseif (is_array($this->value)) {
                    $result = array_merge($this->value, $result);
                }
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function jsonDeserialize(array $data): static
    {
        $args = [];
        if (!array_key_exists('platform', $data)) {
            throw new Exception(
                "JSON data is missing property 'platform'",
            );
        }
        $platform = $data['platform'];
        if (!(is_string($platform))) {
            throw new Exception(
                "Expected property 'platform' in JSON data to be string, instead received " . get_debug_type($data['platform']),
            );
        }

        $args['platform'] = $platform;
        switch ($platform) {
            case 'discord':
                $args['value'] = ConnectDiscordChat::jsonDeserialize($data);
                break;
            case 'telegram':
                $args['value'] = ConnectTelegramChat::jsonDeserialize($data);
                break;
            case '_unknown':
            default:
                $args['platform'] = '_unknown';
                $args['value'] = $data;
        }

        // @phpstan-ignore-next-line
        return new static($args);
    }
}
