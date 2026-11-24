# frozen_string_literal: true

module Peal
  module Inbox
    class Client
      # @param client [Peal::Internal::Http::RawClient]
      #
      # @return [void]
      def initialize(client:)
        @client = client
      end

      # @return [Peal::Comments::Client]
      def comments
        @comments ||= Peal::Inbox::Comments::Client.new(client: @client)
      end

      # @return [Peal::Messages::Client]
      def messages
        @messages ||= Peal::Inbox::Messages::Client.new(client: @client)
      end

      # @return [Peal::Reviews::Client]
      def reviews
        @reviews ||= Peal::Inbox::Reviews::Client.new(client: @client)
      end
    end
  end
end
