<?php

namespace Peal\Types;

enum TranscriptionRejectedEncodedReason: string
{
    case NotAudio = "notAudio";
    case NotReady = "notReady";
    case TooLarge = "tooLarge";
}
