<?php

namespace Peal\Types;

enum CommentRulePrivateAbility: string
{
    case Available = "available";
    case NoApi = "noApi";
    case Unsupported = "unsupported";
    case MessagesOff = "messagesOff";
    case Reconnect = "reconnect";
    case TextTooLong = "textTooLong";
}
