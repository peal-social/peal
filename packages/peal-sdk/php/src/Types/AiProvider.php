<?php

namespace Peal\Types;

enum AiProvider: string
{
    case Anthropic = "anthropic";
    case Openai = "openai";
    case Google = "google";
    case Mistral = "mistral";
    case Xai = "xai";
    case Groq = "groq";
    case Togetherai = "togetherai";
    case Deepseek = "deepseek";
    case Openrouter = "openrouter";
    case Cerebras = "cerebras";
    case Fireworks = "fireworks";
    case OpenaiCompatible = "openai-compatible";
    case Elevenlabs = "elevenlabs";
    case Fal = "fal";
    case Shotstack = "shotstack";
}
