# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module NoticeEventVideoGenerationEndedOutcome
      extend Peal::Internal::Types::Enum

      SUCCEEDED = "succeeded"
      FAILED = "failed"
    end
  end
end
