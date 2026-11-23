<?php

namespace Peal\Types;

enum AudioProviderFailedEncodedCapability: string
{
    case Speech = "speech";
    case Transcription = "transcription";
}
