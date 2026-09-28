using Google.Apis.Auth;
using HabitCheckin.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace HabitCheckin.Infrastructure.Auth;

public sealed class GoogleOptions
{
    public const string SectionName = "Google";
    public string ClientId { get; set; } = string.Empty;
}

public sealed class GoogleTokenValidator(IOptions<GoogleOptions> options) : IGoogleTokenValidator
{
    public async Task<GoogleTokenPayload?> ValidateAsync(string idToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.Value.ClientId) ||
            options.Value.ClientId.StartsWith("REPLACE_", StringComparison.Ordinal))
        {
            return null; // chưa cấu hình Google ClientId
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature
                .ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = [options.Value.ClientId]
                })
                .ConfigureAwait(false);
        }
        catch (Exception)
        {
            return null;
        }

        if (string.IsNullOrEmpty(payload.Email) || !payload.EmailVerified)
            return null;

        return new GoogleTokenPayload(payload.Subject, payload.Email, payload.Name);
    }
}
