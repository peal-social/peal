<?php

namespace Peal\Types;

enum SlideMotion: string
{
    case None = "none";
    case ZoomIn = "zoomIn";
    case ZoomOut = "zoomOut";
    case Slide = "slide";
}
