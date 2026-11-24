# frozen_string_literal: true

module Peal
  module Media
    module Images
      class Client
        # @param client [Peal::Internal::Http::RawClient]
        #
        # @return [void]
        def initialize(client:)
          @client = client
        end

        # Asks for one image from the prompt, in the aspect asked for, and answers with it as a new file of the media
        # library, ready to attach, marked `aiGenerated` and without a description. When the workspace brought its own
        # image provider, the prompt goes there, with the workspace's key, and the image costs none of the workspace's
        # daily requests, on any plan, a trial and the free plan included, within a number of such images a day
        # (OwnImageLimitReached past it); if that provider refuses, the answer is ImageProviderRefused and the server's
        # model is never asked instead. Otherwise the prompt goes to the image provider the server's operator chose. On
        # a server that does not bill, an image costs the status's `images.requestCost` of the workspace's daily
        # requests, given back only when the provider could not be reached. On a server that bills, it needs a payment
        # method on the billing account (UsageAllowanceReached `paymentMethodRequired` without one, before anything is
        # asked) and counts one of the month's images (`images.month`), billed past the allowance up to the account's
        # ceiling (UsageAllowanceReached `ceilingReached`); an image that is not stored, whatever the reason, is not
        # counted. Neither the prompt nor the image is logged. Either way the image takes room in the plan's media
        # storage, which must hold the largest image before anything is asked. The file is stored as the provider gave
        # it. Peal sets no platform's AI label on its own: set it in the post's options (YouTube
        # `containsSyntheticMedia`, TikTok `aiGenerated`, X `madeWithAi`). Needs assistant:use and media:upload. Off
        # unless the workspace brought a provider or the server has an image model (`images.source`).
        #
        # @param request_options [Hash]
        # @param params [Peal::Media::Images::Types::ImageRequest]
        # @option request_options [String] :base_url
        # @option request_options [Hash{String => Object}] :additional_headers
        # @option request_options [Hash{String => Object}] :additional_query_parameters
        # @option request_options [Hash{String => Object}] :additional_body_parameters
        # @option request_options [Integer] :timeout_in_seconds
        #
        # @example
        #   client.media.images.create(
        #     aspect: "square",
        #     prompt: "prompt"
        #   )
        #
        # @return [Peal::Types::Media]
        def create(request_options: {}, **params)
          params = Peal::Internal::Types::Utils.normalize_keys(params)
          request = Peal::Internal::JSON::Request.new(
            base_url: request_options[:base_url],
            method: "POST",
            path: "api/v1/media/images",
            body: Peal::Media::Images::Types::ImageRequest.new(params).to_h,
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
            (response.body.to_s.empty? ? nil : Peal::Types::Media.load(response.body))
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
