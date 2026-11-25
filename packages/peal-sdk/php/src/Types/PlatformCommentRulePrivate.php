<?php

namespace Peal\Types;

enum PlatformCommentRulePrivate: string
{
    case Available = "available";
    case NoApi = "noApi";
    case Unsupported = "unsupported";
}
