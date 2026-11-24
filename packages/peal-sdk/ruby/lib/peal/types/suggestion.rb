# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class Suggestion < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::SuggestionText }, key: "text"

      member -> { Peal::Types::SuggestionHashtags }, key: "hashtags"
    end
  end
end
