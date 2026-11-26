<?php

namespace Peal\Types;

enum BodyProblemKind: string
{
    case HeadingLevel = "headingLevel";
    case Html = "html";
    case Table = "table";
    case Footnote = "footnote";
    case FrontMatter = "frontMatter";
    case Image = "image";
    case Link = "link";
    case TooLarge = "tooLarge";
    case NotTaken = "notTaken";
}
