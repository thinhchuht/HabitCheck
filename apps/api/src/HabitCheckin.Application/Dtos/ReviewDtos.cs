using HabitCheckin.Domain.Enums;
using MediatR;

namespace HabitCheckin.Application.Dtos;

public sealed record ProofUserDto(string UserId, string DisplayName, string? AvatarUrl);
public sealed record ProofActivityDto(string Name, string? Icon, ActivityType Type);
public sealed record ProofChallengeDto(string Id, string Title, ChallengeStatus Status);
public sealed record ProofReportDto(string Reason, string ReporterName, string At);
public sealed record ProofReviewDto(string Action, string? Reason, string ReviewerName, string At);

public sealed record ProofFeedItemDto(
    CheckInDto Checkin,
    ProofUserDto User,
    ProofActivityDto Activity,
    ProofChallengeDto Challenge,
    List<ProofReportDto> Reports,
    ProofReviewDto? Review);

public sealed record ProofFeedDto(string Date, string? FinalizeAt, List<ProofFeedItemDto> Items);

public sealed record ReportProofCommand(Guid CheckinId, string Reason) : IRequest<bool>;
public sealed record RejectProofCommand(Guid CheckinId, string Reason) : IRequest<bool>;
