# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module VideoRequestRejectedEncodedReason
      extend Peal::Internal::Types::Enum

      ASPECT_NOT_OFFERED = "aspectNotOffered"
      DURATION_NOT_OFFERED = "durationNotOffered"
      IMAGE_NOT_OFFERED = "imageNotOffered"
      IMAGE_NOT_FOUND = "imageNotFound"
    end
  end
end
