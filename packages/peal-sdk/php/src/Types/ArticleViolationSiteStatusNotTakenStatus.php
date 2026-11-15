<?php

namespace Peal\Types;

enum ArticleViolationSiteStatusNotTakenStatus: string
{
    case Publish = "publish";
    case Draft = "draft";
    case Future = "future";
}
