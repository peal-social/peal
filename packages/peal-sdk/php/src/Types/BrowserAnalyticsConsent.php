<?php

namespace Peal\Types;

enum BrowserAnalyticsConsent: string
{
    case Undecided = "undecided";
    case Granted = "granted";
    case Refused = "refused";
}
