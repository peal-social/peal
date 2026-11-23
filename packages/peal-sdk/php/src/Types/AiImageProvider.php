<?php

namespace Peal\Types;

enum AiImageProvider: string
{
    case Openai = "openai";
    case Google = "google";
    case Xai = "xai";
    case Togetherai = "togetherai";
    case OpenaiCompatible = "openai-compatible";
    case Fal = "fal";
}
