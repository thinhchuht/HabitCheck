using MediatR;

namespace HabitCheckin.Application.Dtos;

public sealed record PenaltyTiersDto(long[] Tiers, long ExtraPerActivity);

public sealed record MemberDto(string UserId, string DisplayName, string? AvatarUrl, string Role, string JoinedAt);

public sealed record GroupDto(
    string Id,
    string Name,
    string InviteCode,
    string OwnerId,
    PenaltyTiersDto PenaltyTiers,
    int ReviewWindowHours,
    string CreatedAt,
    List<MemberDto> Members);

public sealed record CreateGroupCommand(string Name) : IRequest<GroupDto>;
public sealed record JoinGroupCommand(string InviteCode) : IRequest<GroupDto>;
public sealed record UpdatePenaltyTiersCommand(Guid GroupId, long[] Tiers, long ExtraPerActivity) : IRequest<GroupDto>;
public sealed record RemoveMemberCommand(Guid GroupId, Guid UserId) : IRequest<bool>;
