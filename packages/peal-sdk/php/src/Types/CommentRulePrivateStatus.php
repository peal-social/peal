<?php

namespace Peal\Types;

enum CommentRulePrivateStatus: string
{
    case Sending = "sending";
    case Sent = "sent";
    case Failed = "failed";
    case Unconfirmed = "unconfirmed";
}
