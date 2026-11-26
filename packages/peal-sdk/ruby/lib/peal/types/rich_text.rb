# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    # The rich-text editor's document: blocks of paragraphs, headings, lists, quotes, rules, code (with its language)
    # and images.
    class RichText < Internal::Types::Model
      field :content, -> { Internal::Types::Array[Object] }, optional: false, nullable: false

      field :type, -> { Peal::Types::RichTextType }, optional: false, nullable: false
    end
  end
end
