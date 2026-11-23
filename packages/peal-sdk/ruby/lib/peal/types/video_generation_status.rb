# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module VideoGenerationStatus
      extend Peal::Internal::Types::Enum

      QUEUED = "queued"
      RUNNING = "running"
      SUCCEEDED = "succeeded"
      FAILED = "failed"
    end
  end
end
