<?php

namespace Peal\Inbox\Comments\Types;

enum ListThreadsCommentsRequestUnanswered: string
{
    case True = "true";
    case False = "false";
}
