using MediatR;

namespace HabitCheckin.Application.Dtos;

public sealed record AuthResponse(string AccessToken, string TokenType, int ExpiresIn);

public sealed record ReminderDto(int? DeadlineAheadMinutes, bool EndOfDayReminder);

public sealed record UserDto(
    string Id,
    string GoogleSub,
    string Email,
    string DisplayName,
    string? AvatarUrl,
    ReminderDto Reminder,
    string CreatedAt,
    string? LastLoginAt,
    bool IsAdmin);

public sealed record GoogleLoginResult(UserDto User, string AccessToken, string RefreshTokenValue, int AccessExpiresIn);

public sealed record UpdateMeCommand(string? DisplayName, int? DeadlineAheadMinutes, bool? EndOfDayReminder)
    : IRequest<UserDto>;
