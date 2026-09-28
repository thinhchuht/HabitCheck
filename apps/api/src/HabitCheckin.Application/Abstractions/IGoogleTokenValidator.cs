namespace HabitCheckin.Application.Abstractions;

public sealed record GoogleTokenPayload(string Sub, string Email, string? Name);

public interface IGoogleTokenValidator
{
    /// <summary>Trả về null nếu token không hợp lệ (audience sai, hết hạn, email chưa xác minh...).</summary>
    Task<GoogleTokenPayload?> ValidateAsync(string idToken, CancellationToken ct = default);
}
