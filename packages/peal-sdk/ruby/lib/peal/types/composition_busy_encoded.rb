# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class CompositionBusyEncoded < Internal::Types::Model
      field :code, -> { String }, optional: true, nullable: false

      field :message, -> { String }, optional: true, nullable: false

      field :request_id, -> { String }, optional: true, nullable: false, api_name: "requestId"

      field :slideshow_id, -> { String }, optional: false, nullable: false, api_name: "slideshowId"
    end
  end
end
