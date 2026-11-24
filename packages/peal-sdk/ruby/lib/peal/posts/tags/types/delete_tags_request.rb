# frozen_string_literal: true

module Peal
  module Posts
    module Tags
      module Types
        class DeleteTagsRequest < Internal::Types::Model
          field :tag_id, -> { String }, optional: false, nullable: false, api_name: "tagId"
        end
      end
    end
  end
end
