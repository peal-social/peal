<?php

namespace Peal\Types;

enum VideoUnavailableEncodedReason: string
{
    case NotSet = "notSet";
    case KeyUnreadable = "keyUnreadable";
}
