# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ConflictErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::ChannelAccountTakenEncoded }, key: "ChannelAccountTaken"

      member -> { Peal::Types::IdempotencyKeyReusedEncoded }, key: "IdempotencyKeyReused"

      member -> { Peal::Types::WorkspaceBusyEncoded }, key: "WorkspaceBusy"
    end
  end
end
