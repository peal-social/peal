<?php

namespace Peal\Automations\Feeds\Types;

enum FeedChangeStatus: string
{
    case Active = "active";
    case Paused = "paused";
}
