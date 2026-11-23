<?php

namespace Peal\Types;

enum AudioUnavailableEncodedReason: string
{
    case NotSet = "notSet";
    case KeyUnreadable = "keyUnreadable";
}
