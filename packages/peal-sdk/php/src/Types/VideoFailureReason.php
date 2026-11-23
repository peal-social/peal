<?php

namespace Peal\Types;

enum VideoFailureReason: string
{
    case Unavailable = "unavailable";
    case KeyUnreadable = "keyUnreadable";
    case SettingsRefused = "settingsRefused";
    case AddressRefused = "addressRefused";
    case Redirected = "redirected";
    case Unreachable = "unreachable";
    case Refused = "refused";
    case TimedOut = "timedOut";
    case UnusableAnswer = "unusableAnswer";
    case ImageUnavailable = "imageUnavailable";
    case StorageFull = "storageFull";
    case NotStored = "notStored";
    case Interrupted = "interrupted";
}
