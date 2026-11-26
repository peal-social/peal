# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module SiteStatusOption
      extend Peal::Internal::Types::Enum

      PUBLISH = "publish"
      DRAFT = "draft"
    end
  end
end
