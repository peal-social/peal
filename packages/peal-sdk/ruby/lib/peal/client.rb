# frozen_string_literal: true

module Peal
  class Client
    # @param token [String]
    # @param base_url [String, nil]
    # @param workspace [String, nil]
    # @param max_retries [Integer]
    # @param timeout [Numeric]
    #
    # @return [void]
    def initialize(token:, base_url: nil, workspace: nil, max_retries: 2, timeout: 60)
      headers = {
        "X-Fern-Language" => "Ruby",
        Authorization: "Bearer #{token}",
        "Peal-Version" => "2026-11-09"
      }
      headers["Peal-Workspace"] = workspace.to_s unless workspace.nil?
      @raw_client = Peal::Internal::Http::RawClient.new(
        base_url: base_url || Peal::Environment::DEFAULT,
        headers: headers,
        overridable_headers: %w[Peal-Workspace],
        max_retries: max_retries,
        timeout: timeout
      )
    end

    # @return [Peal::Posts::Client]
    def posts
      @posts ||= Peal::Posts::Client.new(client: @raw_client)
    end

    # @return [Peal::Approvals::Client]
    def approvals
      @approvals ||= Peal::Approvals::Client.new(client: @raw_client)
    end

    # @return [Peal::Channels::Client]
    def channels
      @channels ||= Peal::Channels::Client.new(client: @raw_client)
    end

    # @return [Peal::Media::Client]
    def media
      @media ||= Peal::Media::Client.new(client: @raw_client)
    end

    # @return [Peal::Analytics::Client]
    def analytics
      @analytics ||= Peal::Analytics::Client.new(client: @raw_client)
    end

    # @return [Peal::Ads::Client]
    def ads
      @ads ||= Peal::Ads::Client.new(client: @raw_client)
    end

    # @return [Peal::Articles::Client]
    def articles
      @articles ||= Peal::Articles::Client.new(client: @raw_client)
    end

    # @return [Peal::Links::Client]
    def links
      @links ||= Peal::Links::Client.new(client: @raw_client)
    end

    # @return [Peal::Webhooks::Client]
    def webhooks
      @webhooks ||= Peal::Webhooks::Client.new(client: @raw_client)
    end

    # @return [Peal::Assistant::Client]
    def assistant
      @assistant ||= Peal::Assistant::Client.new(client: @raw_client)
    end

    # @return [Peal::Partner::Client]
    def partner
      @partner ||= Peal::Partner::Client.new(client: @raw_client)
    end

    # @return [Peal::Credential::Client]
    def credential
      @credential ||= Peal::Credential::Client.new(client: @raw_client)
    end

    # @return [Peal::System::Client]
    def system
      @system ||= Peal::System::Client.new(client: @raw_client)
    end

    # @return [Peal::Automations::Client]
    def automations
      @automations ||= Peal::Automations::Client.new(client: @raw_client)
    end

    # @return [Peal::Inbox::Client]
    def inbox
      @inbox ||= Peal::Inbox::Client.new(client: @raw_client)
    end

    # @return [Peal::Workspace::Client]
    def workspace
      @workspace ||= Peal::Workspace::Client.new(client: @raw_client)
    end
  end
end
