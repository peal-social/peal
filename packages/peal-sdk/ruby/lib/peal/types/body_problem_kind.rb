# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module BodyProblemKind
      extend Peal::Internal::Types::Enum

      HEADING_LEVEL = "headingLevel"
      HTML = "html"
      TABLE = "table"
      FOOTNOTE = "footnote"
      FRONT_MATTER = "frontMatter"
      IMAGE = "image"
      LINK = "link"
      TOO_LARGE = "tooLarge"
      NOT_TAKEN = "notTaken"
    end
  end
end
