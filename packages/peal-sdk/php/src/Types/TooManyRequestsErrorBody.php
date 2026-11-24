<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Exception;

class TooManyRequestsErrorBody extends JsonSerializableType
{
    /**
     * @var (
     *    'OwnTextLimitReached'
     *   |'TextProviderBusy'
     *   |'TooManyRequests'
     *   |'_unknown'
     * ) $type
     */
    public readonly string $type;

    /**
     * @var (
     *    OwnTextLimitReachedEncoded
     *   |TextProviderBusyEncoded
     *   |TooManyRequestsEncoded
     *   |mixed
     * ) $value
     */
    public readonly mixed $value;

    /**
     * @param array{
     *   type: (
     *    'OwnTextLimitReached'
     *   |'TextProviderBusy'
     *   |'TooManyRequests'
     *   |'_unknown'
     * ),
     *   value: (
     *    OwnTextLimitReachedEncoded
     *   |TextProviderBusyEncoded
     *   |TooManyRequestsEncoded
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
     * @param OwnTextLimitReachedEncoded $ownTextLimitReached
     * @return TooManyRequestsErrorBody
     */
    public static function ownTextLimitReached(OwnTextLimitReachedEncoded $ownTextLimitReached): TooManyRequestsErrorBody
    {
        return new TooManyRequestsErrorBody([
            'type' => 'OwnTextLimitReached',
            'value' => $ownTextLimitReached,
        ]);
    }

    /**
     * @param TextProviderBusyEncoded $textProviderBusy
     * @return TooManyRequestsErrorBody
     */
    public static function textProviderBusy(TextProviderBusyEncoded $textProviderBusy): TooManyRequestsErrorBody
    {
        return new TooManyRequestsErrorBody([
            'type' => 'TextProviderBusy',
            'value' => $textProviderBusy,
        ]);
    }

    /**
     * @param TooManyRequestsEncoded $tooManyRequests
     * @return TooManyRequestsErrorBody
     */
    public static function tooManyRequests(TooManyRequestsEncoded $tooManyRequests): TooManyRequestsErrorBody
    {
        return new TooManyRequestsErrorBody([
            'type' => 'TooManyRequests',
            'value' => $tooManyRequests,
        ]);
    }

    /**
     * @return bool
     */
    public function isOwnTextLimitReached(): bool
    {
        return $this->value instanceof OwnTextLimitReachedEncoded && $this->type === 'OwnTextLimitReached';
    }

    /**
     * @return OwnTextLimitReachedEncoded
     */
    public function asOwnTextLimitReached(): OwnTextLimitReachedEncoded
    {
        if (!($this->value instanceof OwnTextLimitReachedEncoded && $this->type === 'OwnTextLimitReached')) {
            throw new Exception(
                "Expected OwnTextLimitReached; got " . $this->type . " with value of type " . get_debug_type($this->value),
            );
        }

        return $this->value;
    }

    /**
     * @return bool
     */
    public function isTextProviderBusy(): bool
    {
        return $this->value instanceof TextProviderBusyEncoded && $this->type === 'TextProviderBusy';
    }

    /**
     * @return TextProviderBusyEncoded
     */
    public function asTextProviderBusy(): TextProviderBusyEncoded
    {
        if (!($this->value instanceof TextProviderBusyEncoded && $this->type === 'TextProviderBusy')) {
            throw new Exception(
                "Expected TextProviderBusy; got " . $this->type . " with value of type " . get_debug_type($this->value),
            );
        }

        return $this->value;
    }

    /**
     * @return bool
     */
    public function isTooManyRequests(): bool
    {
        return $this->value instanceof TooManyRequestsEncoded && $this->type === 'TooManyRequests';
    }

    /**
     * @return TooManyRequestsEncoded
     */
    public function asTooManyRequests(): TooManyRequestsEncoded
    {
        if (!($this->value instanceof TooManyRequestsEncoded && $this->type === 'TooManyRequests')) {
            throw new Exception(
                "Expected TooManyRequests; got " . $this->type . " with value of type " . get_debug_type($this->value),
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
            case 'OwnTextLimitReached':
                $value = $this->asOwnTextLimitReached()->jsonSerialize();
                $result = array_merge($value, $result);
                break;
            case 'TextProviderBusy':
                $value = $this->asTextProviderBusy()->jsonSerialize();
                $result = array_merge($value, $result);
                break;
            case 'TooManyRequests':
                $value = $this->asTooManyRequests()->jsonSerialize();
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
            case 'OwnTextLimitReached':
                $args['value'] = OwnTextLimitReachedEncoded::jsonDeserialize($data);
                break;
            case 'TextProviderBusy':
                $args['value'] = TextProviderBusyEncoded::jsonDeserialize($data);
                break;
            case 'TooManyRequests':
                $args['value'] = TooManyRequestsEncoded::jsonDeserialize($data);
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
