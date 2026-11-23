<?php

namespace Peal\Types;

enum NoticeEventVideoGenerationEndedOutcome: string
{
    case Succeeded = "succeeded";
    case Failed = "failed";
}
