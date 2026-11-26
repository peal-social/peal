<?php

namespace Peal\Types;

enum ChannelPlatform: string
{
    case X = "x";
    case Linkedin = "linkedin";
    case Bluesky = "bluesky";
    case Mastodon = "mastodon";
    case Threads = "threads";
    case Instagram = "instagram";
    case Facebook = "facebook";
    case Tiktok = "tiktok";
    case Youtube = "youtube";
    case Pinterest = "pinterest";
    case GoogleBusiness = "googleBusiness";
    case Discord = "discord";
    case Telegram = "telegram";
    case Slack = "slack";
    case Snapchat = "snapchat";
    case Wordpress = "wordpress";
    case Devto = "devto";
    case Hashnode = "hashnode";
    case WordpressCom = "wordpressCom";
}
