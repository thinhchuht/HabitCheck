using MediatR;

namespace HabitCheckin.Application.Dtos;

public sealed record PenaltyTiersDto(long[] Tiers, long ExtraPerActivity);

public sealed record MemberDto(string UserId, string DisplayName, string? AvatarUrl, string Role, string JoinedAt);

/// Kỳ gần nhất (theo end_date) chưa huỷ của user đang xem trong nhóm — null nếu user chưa có kỳ.
/// Frontend dùng để lọc "nhóm chưa hết hạn" (myChallenge == null || endDate >= hôm nay).
public sealed record MyChallengeInfoDto(string Status, string EndDate);

public sealed record GroupDto(
    string Id,
    string Name,
    string InviteCode,
    string OwnerId,
    PenaltyTiersDto PenaltyTiers,
    int ReviewWindowHours,
    string CreatedAt,
    List<MemberDto> Members,
    MyChallengeInfoDto? MyChallenge = null);

public sealed record CreateGroupCommand(string Name) : IRequest<GroupDto>;
public sealed record JoinGroupCommand(string InviteCode) : IRequest<GroupDto>;
public sealed record UpdatePenaltyTiersCommand(Guid GroupId, long[] Tiers, long ExtraPerActivity) : IRequest<GroupDto>;
public sealed record RemoveMemberCommand(Guid GroupId, Guid UserId) : IRequest<bool>;
