# frozen_string_literal: true

module Peal
  module PartnerAccount
    class Client
      # @param client [Peal::Internal::Http::RawClient]
      #
      # @return [void]
      def initialize(client:)
        @client = client
      end

      # The workspace's partner account and what it holds, null when it has none, and whether its people may open one
      # themselves on this server (`canOpen`). Needs partner:read.
      #
      # @param request_options [Hash]
      # @param _params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.partner_account.get
      #
      # @return [Peal::Types::PartnerStanding]
      def get(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/partner-account",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::PartnerStanding.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Opens a partner account for the workspace, which becomes its home workspace, under the name its customers will
      # read; answers the one it has when it has one. On a server that opens partner accounts through its staff only,
      # answers 403 `PartnerAccountsClosed`. Needs partner:manage, and a signed-in member rather than an API key or an
      # OAuth client.
      #
      # @param request_options [Hash]
      # @param params [Peal::PartnerAccount::Types::OpenPartner]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.partner_account.open(name: "name")
      #
      # @return [Peal::Types::Partner]
      def open(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "POST",
          path: "api/v1/partner-account",
          body: Peal::PartnerAccount::Types::OpenPartner.new(params).to_h,
          request_options: request_options,
          max_retries: 0
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::Partner.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Closes the workspace's partner account: its keys stop working at once. Refused while it owns workspaces (409
      # `PartnerOwnsWorkspaces`): delete each through the partner API first. Needs partner:manage, and a signed-in
      # member rather than an API key or an OAuth client.
      #
      # @param request_options [Hash]
      # @param _params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.partner_account.close
      #
      # @return [untyped]
      def close(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "DELETE",
          path: "api/v1/partner-account",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        return if code.between?(200, 299)

        error_class = Peal::Errors::ResponseError.subclass_for_code(code)
        error_types = {
          401 => Peal::Types::UnauthenticatedEncoded
        }
        error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
        raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
      end

      # Changes the partner account's name, its logo (an HTTPS URL, shown from that address on the hosted pages; null
      # removes it), its accent colour (`#RRGGBB`, drawn as a line beside the logo on the hosted pages, with at least
      # 3:1 contrast against white and against Peal's page background `#FAFAF9`, so it is seen on Peal's light pages;
      # null removes it) or its return origins: what is left out stays as it is. `returnOrigins` replaces the whole
      # list, 20 at most: each is an origin as browsers write it (`https://app.example.com`: HTTPS, or HTTP on this
      # machine alone, with nothing after the host and port). A hosted page sends a customer back only to an address
      # whose origin is one of these, exactly. Needs partner:manage, and a signed-in member rather than an API key or an
      # OAuth client.
      #
      # @param request_options [Hash]
      # @param params [Peal::PartnerAccount::Types::PartnerChange]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.partner_account.update
      #
      # @return [Peal::Types::Partner]
      def update(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "PATCH",
          path: "api/v1/partner-account",
          body: Peal::PartnerAccount::Types::PartnerChange.new(params).to_h,
          request_options: request_options,
          max_retries: 0
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::Partner.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Lists the partner account's keys. Needs partner:read.
      #
      # @param request_options [Hash]
      # @param _params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.partner_account.list_keys
      #
      # @return [Array[Peal::Types::PartnerKey]]
      def list_keys(request_options: {}, **_params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/partner-account/keys",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          Peal::Internal::Types::Utils.coerce(Internal::Types::Array[Peal::Types::PartnerKey], (response.body.to_s.empty? ? nil : JSON.parse(response.body, symbolize_names: true)))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Creates a partner key, and answers with the key itself, which is not shown again. It acts in every workspace the
      # partner owns, with `permissions` (what a product does for its customers: channels, media, posts, analytics, the
      # writing assistant, webhooks, reading the plan's usage; never members, invitations, API keys or billing changes,
      # which answer 422), and on those workspaces themselves with `scopes`. It never acts in the home workspace, nor in
      # any workspace the partner does not own. Needs partner:manage, and a signed-in member rather than an API key or
      # an OAuth client: keys cannot create keys. The key is the caller's: it stops working once they leave the home
      # workspace, are removed or close their account, and once their role no longer holds partner:manage.
      #
      # @param request_options [Hash]
      # @param params [Peal::PartnerAccount::Types::NewPartnerKey]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.partner_account.create_key(
      #     name: "name",
      #     permissions: ["activity:read"],
      #     scopes: ["workspaces:read"]
      #   )
      #
      # @return [Peal::Types::CreatedPartnerKey]
      def create_key(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "POST",
          path: "api/v1/partner-account/keys",
          body: Peal::PartnerAccount::Types::NewPartnerKey.new(params).to_h,
          request_options: request_options,
          max_retries: 0
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::CreatedPartnerKey.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Revokes a partner key: it stops working at once. Needs partner:manage.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [String] :partner_key_id
      #
      # @example
      #   client.partner_account.revoke_key(partner_key_id: "partnerKeyId")
      #
      # @return [untyped]
      def revoke_key(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "DELETE",
          path: "api/v1/partner-account/keys/#{URI.encode_uri_component(params[:partner_key_id].to_s)}",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        return if code.between?(200, 299)

        error_class = Peal::Errors::ResponseError.subclass_for_code(code)
        error_types = {
          401 => Peal::Types::UnauthenticatedEncoded
        }
        error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
        raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
      end

      # Answers, for each workspace the partner owns, what needs attention: its channels (`connected`, `toReconnect`: to
      # reconnect, as `channel.reconnect_needed` told; `off`: turned off), its posts (`scheduledNext7Days`,
      # `awaitingApproval`, `failedLast7Days`: finished in the last 7 days with a channel that failed, as `post.failed`
      # told; `unconfirmedLast7Days`: one that may be live and must be checked) and its inbox (`unanswered`: threads
      # with a comment waiting for an answer). It tells the state at the time of the call; webhooks tell each change as
      # it happens. A section is null where the credential may not read it, never zero. The partner's home workspace is
      # not listed: it is no customer. Newest first, 50 a page unless `limit` (at most 100) says otherwise, in the order
      # and with the cursor of the list of the partner's workspaces (pass `next` as `before`; anything else is refused,
      # 400): page through every customer to find those that need attention, as nothing filters them. `account` comes
      # with the first page only: whether the account's workspaces, which share one plan and one channel count, hold
      # more channels than the plan allows, and so schedule and publish nothing (null on a server that does not bill);
      # with no customer yet, it is the home workspace's own standing. For the home workspace's people: each section
      # only where the caller holds its permission in the home workspace (`channel:read`, `post:read`,
      # `engagement:read`), as the overview across their workspaces gives it, so staff acting as a member read no inbox;
      # `mayApprove` is always false, as they are members of no customer's workspace. Needs partner:read.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [String, nil] :before
      # @option params [String, nil] :limit
      #
      # @example
      #   client.partner_account.overview
      #
      # @return [Peal::Types::PartnerHealth]
      def overview(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        query_params = {}
        query_params["before"] = params[:before] if params.key?(:before)
        query_params["limit"] = params[:limit] if params.key?(:limit)

        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/partner-account/overview",
          query: query_params,
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::PartnerHealth.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Lists the workspaces the partner account owns, newest first, each with the number of channels connected in it,
      # 50 a page unless `limit` (at most 100) says otherwise, with the filters and the paging of the partner API's
      # list. Needs partner:read.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [String, nil] :before
      # @option params [String, nil] :external_id
      # @option params [String, nil] :limit
      # @option params [String, nil] :name
      #
      # @example
      #   client.partner_account.list_workspaces
      #
      # @return [Peal::Types::CustomerWorkspacePage]
      def list_workspaces(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        query_params = {}
        query_params["before"] = params[:before] if params.key?(:before)
        query_params["externalId"] = params[:external_id] if params.key?(:external_id)
        query_params["limit"] = params[:limit] if params.key?(:limit)
        query_params["name"] = params[:name] if params.key?(:name)

        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/partner-account/workspaces",
          query: query_params,
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::CustomerWorkspacePage.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end
    end
  end
end
