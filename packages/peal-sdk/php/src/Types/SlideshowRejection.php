<?php

namespace Peal\Types;

enum SlideshowRejection: string
{
    case ImageNotFound = "imageNotFound";
    case ImageNotSupported = "imageNotSupported";
    case VoiceoverNotFound = "voiceoverNotFound";
    case TooLong = "tooLong";
    case VoiceoverTooLong = "voiceoverTooLong";
    case VoiceoverTooShort = "voiceoverTooShort";
    case EditInvalid = "editInvalid";
    case MediaNotFound = "mediaNotFound";
    case MediaNotSupported = "mediaNotSupported";
    case EditTooLong = "editTooLong";
    case EditTooLarge = "editTooLarge";
    case OutputNotSupported = "outputNotSupported";
}
