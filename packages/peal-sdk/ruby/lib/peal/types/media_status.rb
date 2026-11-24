# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class MediaStatus < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::MediaStatusPending }, key: "pending"

      member -> { Peal::Types::MediaStatusUploaded }, key: "uploaded"

      member -> { Peal::Types::MediaStatusReady }, key: "ready"

      member -> { Peal::Types::MediaStatusRejected }, key: "rejected"
    end
  end
end
