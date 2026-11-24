# frozen_string_literal: true

module Peal
  module Articles
    module Types
      class GetArticlesRequest < Internal::Types::Model
        field :article_id, -> { String }, optional: false, nullable: false, api_name: "articleId"
      end
    end
  end
end
