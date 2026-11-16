# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module AdNetwork
      extend Peal::Internal::Types::Enum

      META = "meta"
      GOOGLE = "google"
    end
  end
end
