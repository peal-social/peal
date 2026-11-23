<?php

namespace Peal\Types;

enum NoticeEventSlideshowEndedOutcome: string
{
    case Succeeded = "succeeded";
    case Failed = "failed";
}
