using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Application.Dtos;

public sealed record DailyReportActivityDto(
    string ActivityId,
    string Name,
    string? Icon,
    ActivityType Type,
    bool? Passed,
    string? FailReason,
    string? FirstCheckinAt);

public sealed record DailyReportChallengeDto(
    string Id,
    string Title,
    string StartDate,
    string EndDate,
    ChallengeStatus Status);

// Kết quả 1 ngày của 1 thành viên (challenge = null nếu ngày đó không có kỳ nào phủ).
public sealed record DailyReportDayDto(
    string Date,
    DailyReportChallengeDto? Challenge,
    bool IsCheatDay,
    int TotalActivities,
    int PassedCount,
    int FailedCount,
    long Penalty,
    ResultStatus? ResultStatus,
    List<DailyReportActivityDto> Activities);

public sealed record DailyReportMemberDto(
    string UserId,
    string DisplayName,
    string? AvatarUrl,
    List<DailyReportDayDto> Days,
    long TotalPenalty,
    int NoFailDays);

public sealed record DailyReportDto(
    string GroupId,
    string GroupName,
    string From,
    string To,
    List<DailyReportMemberDto> Members,
    long TotalPenalty);
