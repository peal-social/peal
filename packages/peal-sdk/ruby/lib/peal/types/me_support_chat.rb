# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class MeSupportChat < Internal::Types::Model
      field :email_signature, -> { String }, optional: false, nullable: false, api_name: "emailSignature"
    end
  end
end
