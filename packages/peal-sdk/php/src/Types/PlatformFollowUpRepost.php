<?php

namespace Peal\Types;

enum PlatformFollowUpRepost: string
{
    case Available = "available";
    case NoApi = "noApi";
    case NotBuilt = "notBuilt";
    case NotAllowed = "notAllowed";
    case NotCounted = "notCounted";
}
