# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class Slide < Internal::Types::Model
      field :caption, -> { String }, optional: true, nullable: false

      field :media_id, -> { String }, optional: false, nullable: false, api_name: "mediaId"

      field :motion, -> { Peal::Types::SlideMotion }, optional: true, nullable: false
    end
  end
end
