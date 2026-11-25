# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class PostTiming < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::PostTimingNow }, key: "now"

      member -> { Peal::Types::PostTimingAt }, key: "at"

      member -> { Peal::Types::PostTimingQueue }, key: "queue"
    end
  end
end
