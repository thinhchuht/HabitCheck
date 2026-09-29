using MediatR;

namespace HabitCheckin.Application.Dtos;

public sealed record StatDayDto(string Date, int Passed, int Failed, int Total, long Penalty);

public sealed record StatActivityDto(
    string ActivityId,
    string Name,
    string? Icon,
    double CompletionRate,
    string? AvgCheckinTime,
    int? AvgMinutes);

public sealed record StatChallengeDto(
    string ChallengeId,
    string Title,
    string From,
    string To,
    double CompletionRate,
    long TotalPenalty);

public sealed record PersonalStatsDto(
    string From,
    string To,
    int TotalDays,
    int PassedDays,
    double CompletionRate,
    int CurrentStreak,
    int BestStreak,
    long TotalPenalty,
    List<StatDayDto> ByDay,
    List<StatActivityDto> ByActivity,
    List<StatChallengeDto> ByChallenge);

public sealed record GetUserStatsCommand(string? From, string? To) : IRequest<PersonalStatsDto>;

public sealed record HeatmapDayDto(string Date, string State, int Failed, int Total);
public sealed record HeatmapDto(int Year, List<HeatmapDayDto> Days);
public sealed record GetHeatmapCommand(int? Year) : IRequest<HeatmapDto>;

public sealed record LeaderboardRowDto(
    int Rank,
    string UserId,
    string DisplayName,
    string? AvatarUrl,
    int TotalActivities,
    int PassedActivities,
    double CompletionRate,
    long TotalPenalty,
    int CurrentStreak,
    int BestStreak);

public sealed record GetLeaderboardCommand(Guid GroupId, string? From, string? To)
    : IRequest<List<LeaderboardRowDto>>;
