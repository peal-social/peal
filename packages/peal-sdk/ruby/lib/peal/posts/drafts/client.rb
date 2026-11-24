# frozen_string_literal: true

module Peal
  module Posts
    module Drafts
      class Client
        # @param client [Peal::Internal::Http::RawClient]
        #
        # @return [void]
        def initialize(client:)
          @client = client
        end

        # Lists the workspace's drafts, newest first, 20 a page unless `limit` (at most 50) says otherwise. Pass the
        # page's `nextCursor` as `cursor` for the next one. Needs post:read.
        #
        # @param request_options [Hash]
        # @param params [Hash]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String, nil] :cursor
        # @option params [String, nil] :limit
        #
        # @example
        #   client.posts.drafts.list
        #
        # @return [Peal::Types::DraftPage]
        def list(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          query_params = {}
          query_params["cursor"] = params[:cursor] if params.key?(:cursor)
          query_params["limit"] = params[:limit] if params.key?(:limit)

          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "GET",
            path: "api/v1/posts/drafts",
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
            (response.body.to_s.empty? ? nil : Peal::Types::DraftPage.load(response.body))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Creates a draft for some of the workspace's channels, possibly none yet, with options on those whose platform
        # takes them (`TargetOptions`, of the channel's platform). Its media must be the workspace's, and ready. Its
        # text, media and options are checked against each platform's rules when it is scheduled, not before. It may
        # name channel sets (`channelSets`, by id or name), whose connected channels it is for as well, with the options
        # each set keeps; a channel of a set that is no longer connected is left out, and the answer says so
        # (`warnings`). A channel on which it gives no options takes the channel's default options, if it has some. With
        # `defaultSignatures`, each channel's default signature goes under its text, and `signatureId` puts one
        # signature under it on every channel: a signature is then text of the post, never added under a text that
        # already ends with it. `shortenLinks: true` sends its links shortened where the server has short links
        # (`links.status`), `false` as written; left out, the post takes the workspace's default (`byDefault`) when it
        # is made, and keeps it. Needs post:create, channel:read, and media:read when it shows media.
        #
        # @param request_options [Hash]
        # @param params [Peal::Types::PostDraft]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        #
        # @example
        #   client.posts.drafts.create(
        #     channel_ids: ["channelIds"],
        #     content: {
        #       media: [{
        #         altText: "altText",
        #         mediaId: "mediaId"
        #       }],
        #       overrides: [{
        #         channelId: "channelId",
        #         text: "text"
        #       }],
        #       text: "text"
        #     }
        #   )
        #
        # @return [Peal::Types::Post]
        def create(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "POST",
            path: "api/v1/posts/drafts",
            body: Peal::Types::PostDraft.new(params).to_h,
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
            (response.body.to_s.empty? ? nil : Peal::Types::Post.load(response.body))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Deletes a draft. A post scheduled or sent is a conflict: cancel it instead. Needs post:delete, or post:update
        # for the user who created the draft.
        #
        # @param request_options [Hash]
        # @param params [Hash]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String] :post_id
        #
        # @example
        #   client.posts.drafts.delete(post_id: "postId")
        #
        # @return [untyped]
        def delete(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "DELETE",
            path: "api/v1/posts/drafts/#{URI.encode_uri_component(params[:post_id].to_s)}",
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
      end
    end
  end
end
