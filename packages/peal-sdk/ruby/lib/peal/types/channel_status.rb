# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ChannelStatus < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::ChannelStatusActive }, key: "active"

      member -> { Peal::Types::ChannelStatusRefreshNeeded }, key: "refreshNeeded"

      member -> { Peal::Types::ChannelStatusDisabled }, key: "disabled"
    end
  end
end
