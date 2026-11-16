<?php

namespace Peal\Types;

enum ChatNotConnectedReason: string
{
    case AddressNotAWebhook = "addressNotAWebhook";
    case WebhookNotFound = "webhookNotFound";
    case WebhookKindNotSupported = "webhookKindNotSupported";
    case CredentialsRefused = "credentialsRefused";
    case ChatNotFound = "chatNotFound";
    case ChatKindNotSupported = "chatKindNotSupported";
    case CannotPost = "cannotPost";
}
