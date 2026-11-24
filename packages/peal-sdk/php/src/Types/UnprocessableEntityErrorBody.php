<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Exception;

class UnprocessableEntityErrorBody extends JsonSerializableType
{
    /**
     * @var (
     *    'AiCapabilityNotOffered'
     *   |'AiModelRequired'
     *   |'_unknown'
     * ) $type
     */
    public readonly string $type;

    /**
     * @var (
     *    AiCapabilityNotOfferedEncoded
     *   |AiModelRequiredEncoded
     *   |mixed
     * ) $value
     */
    public readonly mixed $value;

    /**
     * @param array{
     *   type: (
     *    'AiCapabilityNotOffered'
     *   |'AiModelRequired'
     *   |'_unknown'
     * ),
     *   value: (
     *    AiCapabilityNotOfferedEncoded
     *   |AiModelRequiredEncoded
     *   |mixed
     * ),
     * } $values
     */
    private function __construct(
        array $values,
    ) {
        $this->type = $values['type'];
        $this->value = $values['value'];
    }

    /**
     * @param AiCapabilityNotOfferedEncoded $aiCapabilityNotOffered
     * @return UnprocessableEntityErrorBody
     */
    public static function aiCapabilityNotOffered(AiCapabilityNotOfferedEncoded $aiCapabilityNotOffered): UnprocessableEntityErrorBody
    {
        return new UnprocessableEntityErrorBody([
            'type' => 'AiCapabilityNotOffered',
            'value' => $aiCapabilityNotOffered,
        ]);
    }

    /**
     * @param AiModelRequiredEncoded $aiModelRequired
     * @return UnprocessableEntityErrorBody
     */
    public static function aiModelRequired(AiModelRequiredEncoded $aiModelRequired): UnprocessableEntityErrorBody
    {
        return new UnprocessableEntityErrorBody([
            'type' => 'AiModelRequired',
            'value' => $aiModelRequired,
        ]);
    }

    /**
     * @return bool
     */
    public function isAiCapabilityNotOffered(): bool
    {
        return $this->value instanceof AiCapabilityNotOfferedEncoded && $this->type === 'AiCapabilityNotOffered';
    }

    /**
     * @return AiCapabilityNotOfferedEncoded
     */
    public function asAiCapabilityNotOffered(): AiCapabilityNotOfferedEncoded
    {
        if (!($this->value instanceof AiCapabilityNotOfferedEncoded && $this->type === 'AiCapabilityNotOffered')) {
            throw new Exception(
                "Expected AiCapabilityNotOffered; got " . $this->type . " with value of type " . get_debug_type($this->value),
            );
        }

        return $this->value;
    }

    /**
     * @return bool
     */
    public function isAiModelRequired(): bool
    {
        return $this->value instanceof AiModelRequiredEncoded && $this->type === 'AiModelRequired';
    }

    /**
     * @return AiModelRequiredEncoded
     */
    public function asAiModelRequired(): AiModelRequiredEncoded
    {
        if (!($this->value instanceof AiModelRequiredEncoded && $this->type === 'AiModelRequired')) {
            throw new Exception(
                "Expected AiModelRequired; got " . $this->type . " with value of type " . get_debug_type($this->value),
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
        $result['_tag'] = $this->type;

        $base = parent::jsonSerialize();
        $result = array_merge($base, $result);

        switch ($this->type) {
            case 'AiCapabilityNotOffered':
                $value = $this->asAiCapabilityNotOffered()->jsonSerialize();
                $result = array_merge($value, $result);
                break;
            case 'AiModelRequired':
                $value = $this->asAiModelRequired()->jsonSerialize();
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
        if (!array_key_exists('_tag', $data)) {
            throw new Exception(
                "JSON data is missing property '_tag'",
            );
        }
        $type = $data['_tag'];
        if (!(is_string($type))) {
            throw new Exception(
                "Expected property 'type' in JSON data to be string, instead received " . get_debug_type($data['_tag']),
            );
        }

        $args['type'] = $type;
        switch ($type) {
            case 'AiCapabilityNotOffered':
                $args['value'] = AiCapabilityNotOfferedEncoded::jsonDeserialize($data);
                break;
            case 'AiModelRequired':
                $args['value'] = AiModelRequiredEncoded::jsonDeserialize($data);
                break;
            case '_unknown':
            default:
                $args['type'] = '_unknown';
                $args['value'] = $data;
        }

        // @phpstan-ignore-next-line
        return new static($args);
    }
}
