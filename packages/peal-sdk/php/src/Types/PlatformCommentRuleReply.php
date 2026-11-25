<?php

namespace Peal\Types;

enum PlatformCommentRuleReply: string
{
    case Available = "available";
    case NoApi = "noApi";
    case NotAllowed = "notAllowed";
    case Unsupported = "unsupported";
}
