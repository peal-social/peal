# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class AssistantVideosStatus < Internal::Types::Model
      field :available, -> { Internal::Types::Boolean }, optional: false, nullable: false

      field :daily_limit, -> { Integer }, optional: false, nullable: false, api_name: "dailyLimit"

      field :max_prompt_length, -> { Integer }, optional: false, nullable: false, api_name: "maxPromptLength"

      field :provider, -> { Peal::Types::AiProvider }, optional: false, nullable: true

      field :remaining, -> { Integer }, optional: false, nullable: false
    end
  end
end
