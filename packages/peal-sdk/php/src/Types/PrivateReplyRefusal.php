<?php

namespace Peal\Types;

enum PrivateReplyRefusal: string
{
    case OwnComment = "ownComment";
    case Gone = "gone";
    case TooOld = "tooOld";
}
