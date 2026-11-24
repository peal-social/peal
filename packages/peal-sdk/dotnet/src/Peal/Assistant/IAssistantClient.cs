namespace Peal;

public partial interface IAssistantClient
{
    /// <summary>
    /// Tells whether the assistant writes for the workspace, so clients show it or hide it, and who writes (`source`: the workspace's own text provider, the server's language model, or nobody), who makes the workspace's images (`images.source`: the workspace's own provider, the server's image model, or nobody) and what one costs, and how many requests the workspace has left today. On a server that bills, `month` and `images.month` tell the billing account's month of the server's models (included, used, price and ceiling), and `reason` `paymentMethod` why they are off without a payment method. Needs assistant:use.
    /// </summary>
    WithRawResponseTask<AssistantStatus> StatusAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Asks the language model to rewrite, shorten or translate a post's text, to suggest hashtags for it, or to write a first post from a subject (`write`), and answers once the whole suggestion is checked. The text is sent to the model as data, never as instructions. When the workspace brought its own text provider (`source` `workspace` in the status), the text goes there, with the workspace's key, and the request costs none of the workspace's daily requests, on any plan, within a number of such requests a day (OwnTextLimitReached past it) and a few at once (TextProviderBusy past them); if that provider refuses, the answer is TextProviderRefused and the server's model is never asked instead. Otherwise, on a server that does not bill, each request counts toward the workspace's daily quota, unless the model's provider could not be reached (AssistantQuotaExceeded past it). On a server that bills, the server's model needs a payment method on the billing account (UsageAllowanceReached `paymentMethodRequired` without one, before anything is asked): each request counts toward the month's allowance across the account's workspaces (the status's `month`), then is billed at its price up to the ceiling the account set (UsageAllowanceReached `ceilingReached`); a request that brings no suggestion, a timeout included, is not counted. Needs assistant:use.
    /// </summary>
    WithRawResponseTask<Suggestion> SuggestAsync(
        SuggestionRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Asks for one image from the prompt, in the aspect asked for, and answers with it as a new file of the media library, ready to attach, marked `aiGenerated` and without a description. When the workspace brought its own image provider, the prompt goes there, with the workspace's key, and the image costs none of the workspace's daily requests, on any plan, a trial and the free plan included, within a number of such images a day (OwnImageLimitReached past it); if that provider refuses, the answer is ImageProviderRefused and the server's model is never asked instead. Otherwise the prompt goes to the image provider the server's operator chose. On a server that does not bill, an image costs the status's `images.requestCost` of the workspace's daily requests, given back only when the provider could not be reached. On a server that bills, it needs a payment method on the billing account (UsageAllowanceReached `paymentMethodRequired` without one, before anything is asked) and counts one of the month's images (`images.month`), billed past the allowance up to the account's ceiling (UsageAllowanceReached `ceilingReached`); an image that is not stored, whatever the reason, is not counted. Neither the prompt nor the image is logged. Either way the image takes room in the plan's media storage, which must hold the largest image before anything is asked. The file is stored as the provider gave it. Peal sets no platform's AI label on its own: set it in the post's options (YouTube `containsSyntheticMedia`, TikTok `aiGenerated`, X `madeWithAi`). Needs assistant:use and media:upload. Off unless the workspace brought a provider or the server has an image model (`images.source`).
    /// </summary>
    WithRawResponseTask<Media> GenerateImageAsync(
        ImageRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Reads the image provider the workspace brought, a provider Peal knows by name (OpenAI, Google Gemini, xAI, Together AI) or an endpoint that speaks the OpenAI images API (`POST {baseUrl}/images/generations`), whose images then spend none of the workspace's daily assistant requests: its address and model, never its key, or null. Needs assistant:configure, which no OAuth client holds but Peal's command line (since 2026-11-13; before, any client with workspace:write did).
    /// </summary>
    WithRawResponseTask<ImageProviderSetting> ImageProviderAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Sets the image provider the workspace brings, a provider Peal knows by name (OpenAI, Google Gemini, xAI, Together AI) or an endpoint that speaks the OpenAI images API (`POST {baseUrl}/images/generations`), whose images then spend none of the workspace's daily assistant requests. The workspace's image prompts then go to `baseUrl` (the provider's own address when left out) with `apiKey`, through the API `provider` names (`openai-compatible` when left out); the images still take room in the plan's media storage. Peal keeps the key encrypted for this workspace and this address, never shows it again, and never sends it to another address: `apiKey` may be left out to keep the stored one only while `baseUrl` stays exactly the same (to change the model alone). The address must be public HTTPS; it is checked now, and before every call. The provider is not called: the first image tells whether the settings work. Needs assistant:configure, which no OAuth client holds but Peal's command line (since 2026-11-13; before, any client with workspace:write did).
    /// </summary>
    WithRawResponseTask<ImageProvider> SetImageProviderAsync(
        ImageProviderChange request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Removes the workspace's image provider and its key: images are made by the server's image model again, if it has one, and cost the workspace's daily requests. Needs assistant:configure, which no OAuth client holds but Peal's command line (since 2026-11-13; before, any client with workspace:write did).
    /// </summary>
    WithRawResponseTask RemoveImageProviderAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Reads the text provider the workspace brought, Anthropic's Messages API or an endpoint that speaks the OpenAI chat completions API, whose suggestions then spend none of the workspace's daily assistant requests: the API it speaks, its address and model, never its key, or null. Needs assistant:configure.
    /// </summary>
    WithRawResponseTask<TextProviderSetting> TextProviderAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Sets the text provider the workspace brings, Anthropic's Messages API or an endpoint that speaks the OpenAI chat completions API, whose suggestions then spend none of the workspace's daily assistant requests. The workspace's drafts, and the subjects of the posts it asks the assistant to write, then go to `baseUrl` with `apiKey`, under that provider's terms. Peal keeps the key encrypted for this workspace and this address, never shows it again, and never sends it to another address: `apiKey` may be left out to keep the stored one only while `baseUrl` stays exactly the same (to change the model alone). The address must be public HTTPS; it is checked now, and before every call. A provider that writes no text (ElevenLabs, fal) is AiCapabilityNotOffered. The provider is not called: test it with `POST .../text-provider/test`. Needs assistant:configure, which no OAuth client holds but Peal's command line.
    /// </summary>
    WithRawResponseTask<TextProvider> SetTextProviderAsync(
        TextProviderChange request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Removes the workspace's text provider and its key: the server's language model writes again, if it has one, within the workspace's daily requests. Needs assistant:configure.
    /// </summary>
    WithRawResponseTask RemoveTextProviderAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Sends the workspace's text provider one short request, a rewrite of a fixed sentence, as a member's request would go, and answers 204 once the provider gave a suggestion the assistant can use. Otherwise the answer says why, as a suggestion's would: TextProviderRefused (its settings, a redirect, its address or its key) or AssistantFailed (unreachable, timed out, declined, or an answer the assistant cannot use: often a model without structured output). It counts as one of the day's requests to that provider, and nothing of Peal's. Needs assistant:configure.
    /// </summary>
    WithRawResponseTask TestTextProviderAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Lists the AI providers the workspace connected with a key of its own: where each is reached, never its key. What it uses each for is `GET .../assistant/models`'s to say. Needs assistant:configure, which no OAuth client holds but Peal's command line.
    /// </summary>
    WithRawResponseTask<AiProviderConnections> ProvidersAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Connects a provider of Peal's catalogue (`peal-contract/ai-providers`), or `openai-compatible`, any endpoint of the OpenAI chat completions and images APIs, with the workspace's own key, or changes its address or key. It is then offered for each use it serves (`PUT .../assistant/models/{capability}`), whose requests spend none of Peal's allowance. Peal keeps the key encrypted for this workspace, this provider and this address, never shows it again, and never sends it to another address: `apiKey` may be left out to keep the stored one only while `baseUrl` stays exactly the same. The address must be public HTTPS; it is checked now, and before every call. A provider reached at its own address alone (`fixedAddress`: ElevenLabs, fal, Shotstack) takes no other (AiProviderAddressRefused `fixedAddress`): Shotstack takes its production API (`https://api.shotstack.io/edit/v1`, the default) or its sandbox (`https://api.shotstack.io/edit/stage`, free and watermarked), each with its own key. The provider is not called: test it with `POST .../providers/{provider}/test`. Needs assistant:configure, which no OAuth client holds but Peal's command line.
    /// </summary>
    WithRawResponseTask<AiProviderConnection> ConnectProviderAsync(
        AiProviderConnectionChange request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Removes the provider and its key, and the uses it served: the server's model works for them again, if it has one, within the workspace's allowance. Answers 204 whether or not the provider was connected. Needs assistant:configure, which no OAuth client holds but Peal's command line.
    /// </summary>
    WithRawResponseTask DisconnectProviderAsync(
        DisconnectProviderAssistantRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Sends a connected provider one short request for text, a rewrite of a fixed sentence, as a member's request would go, with `model` (left out, the model the workspace's text is written with when this provider writes it, else the first Peal suggests for it), and answers 204 once the provider gave a suggestion the assistant can use. Otherwise the answer says why, as a suggestion's would: TextProviderRefused (its settings, a redirect, its address or its key) or AssistantFailed (unreachable, timed out, declined, or an answer the assistant cannot use: often a model without structured output). It counts as one of the day's requests to the workspace's own providers, and nothing of Peal's. Needs assistant:configure, which no OAuth client holds but Peal's command line.
    /// </summary>
    WithRawResponseTask TestProviderAsync(
        AiProviderTest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Tells, for each use (text, images, videos, voice-overs, transcripts, slide videos), the connected provider and the model the workspace chose, or none, and whether the server has a model of its own that works meanwhile. Needs assistant:configure, which no OAuth client holds but Peal's command line.
    /// </summary>
    WithRawResponseTask<AiCapabilityModels> ModelsAsync(
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Chooses the provider and the model for one use: the provider must be connected (AiProviderNotConnected otherwise) and offer the use (AiCapabilityNotOffered otherwise), and `model` is required (AiModelRequired) but for `composition`, whose model is always `edit`. The workspace's drafts or prompts for that use then go to it, with the workspace's key, and spend none of Peal's allowance, within a number of such requests a day. The model is not checked: test the provider, or make a first request. Needs assistant:configure, which no OAuth client holds but Peal's command line.
    /// </summary>
    WithRawResponseTask<AiCapabilityModel> SetModelAsync(
        AiCapabilityModelChange request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Leaves a use to the server's model, if it has one (`serverModel`), within the workspace's allowance, or off; the provider stays connected. Needs assistant:configure, which no OAuth client holds but Peal's command line.
    /// </summary>
    WithRawResponseTask UnsetModelAsync(
        UnsetModelAssistantRequest request,
        RequestOptions? options = null,
        CancellationToken cancellationToken = default
    );
}
