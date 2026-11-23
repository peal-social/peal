<?php

namespace Peal\Types;

enum CompositionUnavailableEncodedReason: string
{
    case NotSet = "notSet";
    case KeyUnreadable = "keyUnreadable";
}
