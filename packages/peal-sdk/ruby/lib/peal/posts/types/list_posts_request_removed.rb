# frozen_string_literal: true

require_relative "../../../peal"

module Peal
  module Posts
    module Types
      module ListPostsRequestRemoved
        extend Peal::Internal::Types::Enum

        TRUE = "true"
        FALSE = "false"
      end
    end
  end
end
