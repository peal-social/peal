<?php

namespace Peal\Types;

enum AiCapability: string
{
    case Text = "text";
    case Image = "image";
    case Video = "video";
    case Speech = "speech";
    case Transcription = "transcription";
    case Composition = "composition";
}
