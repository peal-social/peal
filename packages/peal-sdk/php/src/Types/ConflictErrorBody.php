<?php

namespace Peal\Types;

use Peal\Core\Json\JsonSerializableType;
use Exception;

class ConflictErrorBody extends JsonSerializableType
{
    /**
     * @var (
     *    'ChannelAccountTaken'
     *   |'IdempotencyKeyReused'
     *   |'WorkspaceBusy'
     *   |'_unknown'
     * ) $type
     */
    public readonly string $type;

    /**
     * @var (
     *    ChannelAccountTakenEncoded
     *   |IdempotencyKeyReusedEncoded
     *   |WorkspaceBusyEncoded
     *   |mixed
     * ) $value
     */
    public readonly mixed $value;

    /**
     * @param array{
     *   type: (
     *    'ChannelAccountTaken'
     *   |'IdempotencyKeyReused'
     *   |'WorkspaceBusy'
     *   |'_unknown'
     * ),
     *   value: (
     *    ChannelAccountTakenEncoded
     *   |IdempotencyKeyReusedEncoded
     *   |WorkspaceBusyEncoded
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
     * @param ChannelAccountTakenEncoded $channelAccountTaken
     * @return ConflictErrorBody
     */
    public static function channelAccountTaken(ChannelAccountTakenEncoded $channelAccountTaken): ConflictErrorBody
    {
        return new ConflictErrorBody([
            'type' => 'ChannelAccountTaken',
            'value' => $channelAccountTaken,
        ]);
    }

    /**
     * @param IdempotencyKeyReusedEncoded $idempotencyKeyReused
     * @return ConflictErrorBody
     */
    public static function idempotencyKeyReused(IdempotencyKeyReusedEncoded $idempotencyKeyReused): ConflictErrorBody
    {
        return new ConflictErrorBody([
            'type' => 'IdempotencyKeyReused',
            'value' => $idempotencyKeyReused,
        ]);
    }

    /**
     * @param WorkspaceBusyEncoded $workspaceBusy
     * @return ConflictErrorBody
     */
    public static function workspaceBusy(WorkspaceBusyEncoded $workspaceBusy): ConflictErrorBody
    {
        return new ConflictErrorBody([
            'type' => 'WorkspaceBusy',
            'value' => $workspaceBusy,
        ]);
    }

    /**
     * @return bool
     */
    public function isChannelAccountTaken(): bool
    {
        return $this->value instanceof ChannelAccountTakenEncoded && $this->type === 'ChannelAccountTaken';
    }

    /**
     * @return ChannelAccountTakenEncoded
     */
    public function asChannelAccountTaken(): ChannelAccountTakenEncoded
    {
        if (!($this->value instanceof ChannelAccountTakenEncoded && $this->type === 'ChannelAccountTaken')) {
            throw new Exception(
                "Expected ChannelAccountTaken; got " . $this->type . " with value of type " . get_debug_type($this->value),
            );
        }

        return $this->value;
    }

    /**
     * @return bool
     */
    public function isIdempotencyKeyReused(): bool
    {
        return $this->value instanceof IdempotencyKeyReusedEncoded && $this->type === 'IdempotencyKeyReused';
    }

    /**
     * @return IdempotencyKeyReusedEncoded
     */
    public function asIdempotencyKeyReused(): IdempotencyKeyReusedEncoded
    {
        if (!($this->value instanceof IdempotencyKeyReusedEncoded && $this->type === 'IdempotencyKeyReused')) {
            throw new Exception(
                "Expected IdempotencyKeyReused; got " . $this->type . " with value of type " . get_debug_type($this->value),
            );
        }

        return $this->value;
    }

    /**
     * @return bool
     */
    public function isWorkspaceBusy(): bool
    {
        return $this->value instanceof WorkspaceBusyEncoded && $this->type === 'WorkspaceBusy';
    }

    /**
     * @return WorkspaceBusyEncoded
     */
    public function asWorkspaceBusy(): WorkspaceBusyEncoded
    {
        if (!($this->value instanceof WorkspaceBusyEncoded && $this->type === 'WorkspaceBusy')) {
            throw new Exception(
                "Expected WorkspaceBusy; got " . $this->type . " with value of type " . get_debug_type($this->value),
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
            case 'ChannelAccountTaken':
                $value = $this->asChannelAccountTaken()->jsonSerialize();
                $result = array_merge($value, $result);
                break;
            case 'IdempotencyKeyReused':
                $value = $this->asIdempotencyKeyReused()->jsonSerialize();
                $result = array_merge($value, $result);
                break;
            case 'WorkspaceBusy':
                $value = $this->asWorkspaceBusy()->jsonSerialize();
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
            case 'ChannelAccountTaken':
                $args['value'] = ChannelAccountTakenEncoded::jsonDeserialize($data);
                break;
            case 'IdempotencyKeyReused':
                $args['value'] = IdempotencyKeyReusedEncoded::jsonDeserialize($data);
                break;
            case 'WorkspaceBusy':
                $args['value'] = WorkspaceBusyEncoded::jsonDeserialize($data);
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
