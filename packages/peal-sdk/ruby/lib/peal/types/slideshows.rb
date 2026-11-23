# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class Slideshows < Internal::Types::Model
      field :slideshows, -> { Internal::Types::Array[Peal::Types::Slideshow] }, optional: false, nullable: false
    end
  end
end
