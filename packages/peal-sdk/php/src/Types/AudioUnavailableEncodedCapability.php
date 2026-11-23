<?php

namespace Peal\Types;

enum AudioUnavailableEncodedCapability: string
{
    case Speech = "speech";
    case Transcription = "transcription";
}
