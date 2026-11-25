<?php

namespace Peal\Types;

enum PlatformFollowUpComment: string
{
    case Available = "available";
    case NoApi = "noApi";
    case Review = "review";
    case NotBuilt = "notBuilt";
    case NotAllowed = "notAllowed";
    case TurnedOff = "turnedOff";
    case NotCounted = "notCounted";
}
