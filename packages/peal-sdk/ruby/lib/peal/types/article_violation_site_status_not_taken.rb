# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ArticleViolationSiteStatusNotTaken < Internal::Types::Model
      field :status, -> { Peal::Types::ArticleViolationSiteStatusNotTakenStatus }, optional: false, nullable: false
    end
  end
end
