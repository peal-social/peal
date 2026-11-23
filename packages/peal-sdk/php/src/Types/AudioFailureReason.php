<?php

namespace Peal\Types;

enum AudioFailureReason: string
{
    case SettingsRefused = "settingsRefused";
    case AddressRefused = "addressRefused";
    case Redirected = "redirected";
    case Unreachable = "unreachable";
    case Refused = "refused";
    case TimedOut = "timedOut";
    case UnusableAnswer = "unusableAnswer";
}
