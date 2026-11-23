<?php

namespace Peal\Types;

enum VideoRequestRejectedEncodedReason: string
{
    case AspectNotOffered = "aspectNotOffered";
    case DurationNotOffered = "durationNotOffered";
    case ImageNotOffered = "imageNotOffered";
    case ImageNotFound = "imageNotFound";
}
