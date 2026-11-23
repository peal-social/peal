<?php

namespace Peal\Types;

enum SlideshowStatus: string
{
    case Queued = "queued";
    case Running = "running";
    case Succeeded = "succeeded";
    case Failed = "failed";
}
