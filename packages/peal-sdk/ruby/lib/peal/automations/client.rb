# frozen_string_literal: true

module Peal
  module Automations
    class Client
      # @param client [Peal::Internal::Http::RawClient]
      #
      # @return [void]
      def initialize(client:)
        @client = client
      end

      # @return [Peal::CommentRules::Client]
      def comment_rules
        @comment_rules ||= Peal::Automations::CommentRules::Client.new(client: @client)
      end

      # @return [Peal::Queues::Client]
      def queues
        @queues ||= Peal::Automations::Queues::Client.new(client: @client)
      end

      # @return [Peal::Recycling::Client]
      def recycling
        @recycling ||= Peal::Automations::Recycling::Client.new(client: @client)
      end

      # @return [Peal::FollowUps::Client]
      def follow_ups
        @follow_ups ||= Peal::Automations::FollowUps::Client.new(client: @client)
      end

      # @return [Peal::Feeds::Client]
      def feeds
        @feeds ||= Peal::Automations::Feeds::Client.new(client: @client)
      end
    end
  end
end
