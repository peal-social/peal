<?php

namespace Peal\Types;

enum InboxPrivateReplyReason: string
{
    case ChannelUnavailable = "channelUnavailable";
    case ReconnectNeeded = "reconnectNeeded";
    case RateLimited = "rateLimited";
    case PlatformUnavailable = "platformUnavailable";
    case CommentGone = "commentGone";
    case AlreadyAnswered = "alreadyAnswered";
    case Refused = "refused";
    case WindowClosed = "windowClosed";
    case NotSent = "notSent";
    case NoResponse = "noResponse";
    case Interrupted = "interrupted";
    case AdapterFailure = "adapterFailure";
}
