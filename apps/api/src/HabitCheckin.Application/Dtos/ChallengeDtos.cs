using HabitCheckin.Domain.Enums;
using MediatR;

namespace HabitCheckin.Application.Dtos;

public sealed record ActivityDto(
    string Id,
    string ChallengeId,
    string Name,
    string? Description,
    string? Icon,
    ActivityType Type,
    string? DeadlineTime,
    int GraceMinutes,
    int? TargetMinutes,
    int? MinSessionMinutes,
    string? WindowStart,
    string? WindowEnd,
    ProofType ProofType,
    long? OverridePenalty,
    int SortOrder);

public sealed record ChallengeDto(
    string Id,
    string GroupId,
    string UserId,
    string OwnerName,
    string Title,
    string StartDate,
    string EndDate,
    ChallengeStatus Status,
    string? LockedAt,
    string CreatedAt,
    List<ActivityDto> Activities);

/// <summary>Input tạo/sửa hoạt động. Field theo type, validate chéo trong validator.</summary>
public sealed record ActivityInput(
    string Name,
    string? Description,
    string? Icon,
    ActivityType Type,
    string? DeadlineTime,
    int? GraceMinutes,
    int? TargetMinutes,
    int? MinSessionMinutes,
    string? WindowStart,
    string? WindowEnd,
    ProofType? ProofType,
    long? OverridePenalty);

public sealed record CreateChallengeCommand(Guid GroupId, string Title, string StartDate, string EndDate)
    : IRequest<ChallengeDto>;
public sealed record UpdateChallengeCommand(Guid Id, string? Title, string? StartDate, string? EndDate)
    : IRequest<ChallengeDto>;
public sealed record AddActivityCommand(Guid ChallengeId, ActivityInput Activity) : IRequest<ActivityDto>;
public sealed record UpdateActivityCommand(Guid ChallengeId, Guid ActivityId, ActivityInput Activity) : IRequest<ActivityDto>;
public sealed record ReorderActivitiesCommand(Guid ChallengeId, List<Guid> ActivityIds) : IRequest<List<ActivityDto>>;
