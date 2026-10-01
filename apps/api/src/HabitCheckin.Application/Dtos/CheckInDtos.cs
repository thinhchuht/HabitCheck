using HabitCheckin.Domain.Enums;
using MediatR;

namespace HabitCheckin.Application.Dtos;

public sealed record MediaDto(string PublicId, string Url, string? ThumbnailUrl, string Type, long? Bytes);

public sealed record CheckInDto(
    string Id,
    string ActivityId,
    string ActivityName,
    string? Icon,
    string UserId,
    string LocalDate,
    string CheckinAt,
    string? CheckoutAt,
    int? DurationMinutes,
    MediaDto CheckinMedia,
    MediaDto? CheckoutMedia,
    string? Note,
    CheckInStatus Status,
    string CreatedAt);

public sealed record UploadSignatureDto(
    string CloudName,
    string ApiKey,
    string UploadPreset,
    string Folder,
    string PublicId,
    long Timestamp,
    string Signature,
    List<string> AllowedTypes);

public sealed record UploadIntentDto(string IntentId, string ExpiresAt, UploadSignatureDto Upload);

public sealed record CreateUploadIntentCommand(Guid ActivityId, string Kind) : IRequest<UploadIntentDto>;

public sealed record CheckInCommand(Guid ActivityId, Guid IntentId, string PublicId, string? Note) : IRequest<CheckInDto>;

public sealed record CheckOutCommand(Guid CheckinId, Guid IntentId, string PublicId) : IRequest<CheckInDto>;

public sealed record GetCheckInsCommand(string? UserId, string? Date, Guid? ActivityId) : IRequest<List<CheckInDto>>;

public sealed record TodaySessionDto(string? OpenCheckinId, string? StartedAt, int TotalTodayMinutes, int TargetMinutes);

public sealed record TodayItemDto(
    ActivityDto Activity,
    string State,
    string? FailReason,
    bool IsLate,
    string? DeadlineAt,
    TodaySessionDto? Session,
    List<CheckInDto> Checkins);

public sealed record TodayResultDto(int Total, int Passed, int Failed, long Penalty, ResultStatus Status, bool IsCheatDay);

public sealed record TodayDto(
    string Date,
    string ServerTime,
    string Timezone,
    ChallengeDto? ActiveChallenge,
    List<TodayItemDto> Items,
    long ExpectedPenalty,
    TodayResultDto? Result,
    string? CheatDay,
    List<string> CheatDaysThisWeek);
