# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module SlideTransition
      extend Peal::Internal::Types::Enum

      NONE = "none"
      FADE = "fade"
    end
  end
end
