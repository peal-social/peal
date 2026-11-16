<?php

namespace Peal\Types;

enum InboxPrivateReplyStatus: string
{
    case Sending = "sending";
    case Sent = "sent";
    case Failed = "failed";
    case Unconfirmed = "unconfirmed";
}
