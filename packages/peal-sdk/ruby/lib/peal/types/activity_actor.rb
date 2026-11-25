# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ActivityActor < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::ActivityActorUser }, key: "user"

      member -> { Peal::Types::ActivityActorAPIKey }, key: "apiKey"
    end
  end
end
