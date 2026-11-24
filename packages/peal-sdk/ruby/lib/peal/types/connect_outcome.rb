# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ConnectOutcome < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::ConnectOutcomeConnected }, key: "connected"

      member -> { Peal::Types::ConnectOutcomeChoose }, key: "choose"
    end
  end
end
