# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class VideoGenerations < Internal::Types::Model
      field :generations, -> { Internal::Types::Array[Peal::Types::VideoGeneration] }, optional: false, nullable: false
    end
  end
end
