# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module AiProvider
      extend Peal::Internal::Types::Enum

      ANTHROPIC = "anthropic"
      OPENAI = "openai"
      GOOGLE = "google"
      MISTRAL = "mistral"
      XAI = "xai"
      GROQ = "groq"
      TOGETHERAI = "togetherai"
      DEEPSEEK = "deepseek"
      OPENROUTER = "openrouter"
      CEREBRAS = "cerebras"
      FIREWORKS = "fireworks"
      OPENAI_COMPATIBLE = "openai-compatible"
      ELEVENLABS = "elevenlabs"
      FAL = "fal"
      SHOTSTACK = "shotstack"
    end
  end
end
