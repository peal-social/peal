# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class AssistantAction < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::AssistantActionRewrite }, key: "rewrite"

      member -> { Peal::Types::AssistantActionShorten }, key: "shorten"

      member -> { Peal::Types::AssistantActionTranslate }, key: "translate"

      member -> { Peal::Types::AssistantActionHashtags }, key: "hashtags"

      member -> { Peal::Types::AssistantActionWrite }, key: "write"
    end
  end
end
