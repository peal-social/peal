# frozen_string_literal: true

module Peal
  module Slideshows
    class Client
      # @param client [Peal::Internal::Http::RawClient]
      #
      # @return [void]
      def initialize(client:)
        @client = client
      end

      # Lists the slide videos the workspace asked for, newest first, 50 at most, only those with `status` when given.
      # Needs assistant:use.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [String] :workspace_id
      # @option params [Peal::Types::SlideshowStatus, nil] :status
      #
      # @example
      #   client.slideshows.list(workspace_id: "workspaceId")
      #
      # @return [Peal::Types::Slideshows]
      def list(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        query_params = {}
        query_params["status"] = params[:status] if params.key?(:status)

        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/workspaces/#{URI.encode_uri_component(params[:workspace_id].to_s)}/media/slideshows",
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
          (response.body.to_s.empty? ? nil : Peal::Types::Slideshows.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Asks the service the workspace chose for slide videos (`PUT .../assistant/models/composition`, Shotstack) to
      # compose 2 to 10 images of its library, in order, each with an optional caption and motion, optionally over a
      # voice-over of its library, in the aspect asked, and answers 202 with the job, `queued`. Each slide lasts
      # `secondsPerSlide`, or the voice-over's length shared between them, 90 seconds at most in all. Follow it with
      # `GET .../media/slideshows/{id}`; once `succeeded`, the video is a file of the media library (`mediaId`, MP4 at
      # 1080p), not marked `aiGenerated`, and the member who asked is told in the app. The service receives each file
      # through a link that works for an hour, and renders with the workspace's own key, under its terms and at its
      # prices: Peal bills nothing for it. Its sandbox, when the connection names it, is free and watermarks every
      # video. On a server that bills, it needs a payment method on the workspace's billing account
      # (CompositionNeedsPayment). One slide video at a time a workspace (CompositionBusy), 20 a UTC day
      # (CompositionAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest
      # video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is composed
      # fails it (`interrupted`). Neither the captions nor the video are logged, and the captions are kept only while
      # the video is composed. Needs assistant:use and media:upload.
      #
      # @param request_options [Hash]
      # @param params [Peal::Slideshows::Types::SlideshowRequest]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [String] :workspace_id
      #
      # @example
      #   client.slideshows.create(
      #     workspace_id: "workspaceId",
      #     aspect: "square",
      #     slides: [{
      #       mediaId: "mediaId"
      #     }]
      #   )
      #
      # @return [Peal::Types::Slideshow]
      def create(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request_data = Peal::Slideshows::Types::SlideshowRequest.new(params).to_h
        non_body_param_names = %w[workspaceId]
        body = request_data.except(*non_body_param_names)

        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "POST",
          path: "api/workspaces/#{URI.encode_uri_component(params[:workspace_id].to_s)}/media/slideshows",
          body: body,
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
          (response.body.to_s.empty? ? nil : Peal::Types::Slideshow.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Reads where a slide video stands: queued, running, succeeded with its file (`mediaId`), or failed with why
      # (`reason`). Needs assistant:use.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [String] :workspace_id
      # @option params [String] :slideshow_id
      #
      # @example
      #   client.slideshows.get(
      #     workspace_id: "workspaceId",
      #     slideshow_id: "slideshowId"
      #   )
      #
      # @return [Peal::Types::Slideshow]
      def get(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/workspaces/#{URI.encode_uri_component(params[:workspace_id].to_s)}/media/slideshows/#{URI.encode_uri_component(params[:slideshow_id].to_s)}",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::Slideshow.load(response.body))
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
