<?php

namespace Peal\Types;

enum AudioAllowanceReachedEncodedCapability: string
{
    case Speech = "speech";
    case Transcription = "transcription";
}
