<?php

namespace Peal\Inbox\Messages\Types;

enum ListConversationsMessagesRequestUnread: string
{
    case True = "true";
    case False = "false";
}
