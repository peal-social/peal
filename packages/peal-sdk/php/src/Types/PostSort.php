<?php

namespace Peal\Types;

enum PostSort: string
{
    case CreatedDesc = "createdDesc";
    case CreatedAsc = "createdAsc";
    case ScheduledDesc = "scheduledDesc";
    case ScheduledAsc = "scheduledAsc";
    case UpdatedDesc = "updatedDesc";
    case UpdatedAsc = "updatedAsc";
}
