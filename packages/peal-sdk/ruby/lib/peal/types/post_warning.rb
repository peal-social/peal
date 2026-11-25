# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class PostWarning < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::PostWarningChannelsDropped }, key: "channelsDropped"

      member -> { Peal::Types::PostWarningQueueChannelsDropped }, key: "queueChannelsDropped"

      member -> { Peal::Types::PostWarningXNotBilled }, key: "xNotBilled"
    end
  end
end
