# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module SlideMotion
      extend Peal::Internal::Types::Enum

      NONE = "none"
      ZOOM_IN = "zoomIn"
      ZOOM_OUT = "zoomOut"
      SLIDE = "slide"
    end
  end
end
