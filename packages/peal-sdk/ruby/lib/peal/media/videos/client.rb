# frozen_string_literal: true

module Peal
  module Media
    module Videos
      class Client
        # @param client [Peal::Internal::Http::RawClient]
        #
        # @return [void]
        def initialize(client:)
          @client = client
        end

        # Lists the videos the workspace asked for, newest first, 50 at most, only those with `status` when given. Needs
        # assistant:use.
        #
        # @param request_options [Hash]
        # @param params [Hash]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [Peal::Types::VideoGenerationStatus, nil] :status
        #
        # @example
        #   client.media.videos.list
        #
        # @return [Peal::Types::VideoGenerations]
        def list(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          query_params = {}
          query_params["status"] = params[:status] if params.key?(:status)

          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "GET",
            path: "api/v1/media/videos/generations",
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
            (response.body.to_s.empty? ? nil : Peal::Types::VideoGenerations.load(response.body))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Asks the provider the workspace chose for videos (`PUT .../assistant/models/video`) for one video from the
        # prompt, in the aspect asked, optionally of a length and from a first frame, and answers 202 with the job,
        # `queued`: making a video takes minutes. Follow it with `GET .../media/videos/generations/{id}`; once
        # `succeeded`, the video is a file of the media library (`mediaId`), ready to attach, marked `aiGenerated`, and
        # the member who asked is told in the app. Only the workspace's own provider makes videos, with its key, under
        # its terms and at its prices: Peal bills nothing for them. One video at a time a workspace (VideoBusy), 20 a
        # UTC day (VideoAllowanceReached), whatever each ends with. The plan's media storage must have room for the
        # largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is
        # made fails it (`interrupted`), as the provider may have made and billed it. Neither the prompt nor the video
        # is logged, and the prompt is kept only while the video is made. Needs assistant:use and media:upload.
        #
        # @param request_options [Hash]
        # @param params [Peal::Media::Videos::Types::VideoGenerationRequest]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        #
        # @example
        #   client.media.videos.create(
        #     aspect: "square",
        #     prompt: "prompt"
        #   )
        #
        # @return [Peal::Types::VideoGeneration]
        def create(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "POST",
            path: "api/v1/media/videos/generations",
            body: Peal::Media::Videos::Types::VideoGenerationRequest.new(params).to_h,
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
            (response.body.to_s.empty? ? nil : Peal::Types::VideoGeneration.load(response.body))
          else
            error_class = Peal::Errors::ResponseError.subclass_for_code(code)
            error_types = {
              401 => Peal::Types::UnauthenticatedEncoded
            }
            error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
            raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
          end
        end

        # Reads where a video stands: queued, running, succeeded with its file (`mediaId`), or failed with why
        # (`reason`). Needs assistant:use.
        #
        # @param request_options [Hash]
        # @param params [Hash]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        # @option params [String] :generation_id
        #
        # @example
        #   client.media.videos.get(generation_id: "generationId")
        #
        # @return [Peal::Types::VideoGeneration]
        def get(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "GET",
            path: "api/v1/media/videos/generations/#{URI.encode_uri_component(params[:generation_id].to_s)}",
            request_options: request_options
          )
          begin
            response = @client.send(request)
          rescue Net::HTTPRequestTimeout
            raise Peal::Errors::TimeoutError
          end
          code = response.code.to_i
          if code.between?(200, 299)
            (response.body.to_s.empty? ? nil : Peal::Types::VideoGeneration.load(response.body))
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
end
