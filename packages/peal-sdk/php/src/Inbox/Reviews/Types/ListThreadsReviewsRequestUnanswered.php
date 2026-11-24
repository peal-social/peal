<?php

namespace Peal\Inbox\Reviews\Types;

enum ListThreadsReviewsRequestUnanswered: string
{
    case True = "true";
    case False = "false";
}
