using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Domain.ValueObjects;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Groups;

internal static class GroupDtoHelper
{
    /// Load danh sách thành viên kèm user rồi map GroupDto; kèm kỳ gần nhất
    /// (chưa huỷ, theo end_date) của user đang xem trong nhóm → GroupDto.MyChallenge.
    public static async Task<GroupDto> ToDtoAsync(IAppDbContext db, Group group, Guid viewerId, CancellationToken ct)
    {
        var members = await db.GroupMembers.AsNoTracking()
            .Where(m => m.GroupId == group.Id)
            .OrderBy(m => m.JoinedAt)
            .ToListAsync(ct);
        var userDict = await db.Users.AsNoTracking()
            .Where(u => members.Select(m => m.UserId).Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);
        var challenge = await db.Challenges.AsNoTracking()
            .Where(c => c.GroupId == group.Id && c.UserId == viewerId && c.Status != ChallengeStatus.Cancelled)
            .OrderByDescending(c => c.EndDate)
            .FirstOrDefaultAsync(ct);
        var dto = group.ToDto(members.Select(m => (m, userDict[m.UserId])).ToList());
        return dto with
        {
            MyChallenge = challenge is null
                ? null
                : new MyChallengeInfoDto(challenge.Status.ToString().ToUpperInvariant(), Fmt.Date(challenge.EndDate))
        };
    }
}

// ---------- CreateGroup ----------

public sealed class CreateGroupValidator : AbstractValidator<CreateGroupCommand>
{
    public CreateGroupValidator() =>
        RuleFor(x => x.Name).NotEmpty().WithMessage("Thiếu tên nhóm").MaximumLength(100);
}

public sealed class CreateGroupHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<CreateGroupCommand, GroupDto>
{
    public async Task<GroupDto> Handle(CreateGroupCommand cmd, CancellationToken ct)
    {
        var group = new Group
        {
            Name = cmd.Name.Trim(),
            InviteCode = await NewUniqueCodeAsync(db, ct),
            OwnerId = user.Id,
            PenaltyTiers = PenaltyTiers.Default,
            ReviewWindowHours = 12,
            CreatedAt = clock.UtcNow
        };
        db.Groups.Add(group);
        db.GroupMembers.Add(new GroupMember
        {
            GroupId = group.Id,
            UserId = user.Id,
            Role = MemberRole.Owner,
            JoinedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return await GroupDtoHelper.ToDtoAsync(db, group, user.Id, ct);
    }

    private static async Task<string> NewUniqueCodeAsync(IAppDbContext db, CancellationToken ct)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var code = new string(Enumerable.Range(0, 6)
                .Select(_ => alphabet[Random.Shared.Next(alphabet.Length)]).ToArray());
            var exists = await db.Groups.AnyAsync(g => g.InviteCode == code, ct);
            if (!exists) return code;
        }
        throw new ConflictException("Không tạo được mã mời, vui lòng thử lại");
    }
}

// ---------- JoinGroup ----------

public sealed class JoinGroupValidator : AbstractValidator<JoinGroupCommand>
{
    public JoinGroupValidator() =>
        RuleFor(x => x.InviteCode).NotEmpty().WithMessage("Thiếu mã mời");
}

public sealed class JoinGroupHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<JoinGroupCommand, GroupDto>
{
    public async Task<GroupDto> Handle(JoinGroupCommand cmd, CancellationToken ct)
    {
        var code = cmd.InviteCode.Trim().ToUpperInvariant();
        var group = await db.Groups.FirstOrDefaultAsync(g => g.InviteCode == code, ct)
            ?? throw new BusinessRuleException("Mã mời không tồn tại");

        var existing = await db.GroupMembers.FirstOrDefaultAsync(m => m.GroupId == group.Id && m.UserId == user.Id, ct);
        if (existing is null)
        {
            db.GroupMembers.Add(new GroupMember
            {
                GroupId = group.Id,
                UserId = user.Id,
                Role = MemberRole.Member,
                JoinedAt = clock.UtcNow
            });
            await db.SaveChangesAsync(ct);
        }
        return await GroupDtoHelper.ToDtoAsync(db, group, user.Id, ct);
    }
}

// ---------- GetMyGroups ----------

public sealed record GetMyGroupsQuery() : IRequest<List<GroupDto>>;

public sealed class GetMyGroupsHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<GetMyGroupsQuery, List<GroupDto>>
{
    public async Task<List<GroupDto>> Handle(GetMyGroupsQuery request, CancellationToken ct)
    {
        var memberships = await db.GroupMembers.AsNoTracking()
            .Where(m => m.UserId == user.Id)
            .OrderBy(m => m.JoinedAt)
            .ToListAsync(ct);

        var groups = await db.Groups.AsNoTracking()
            .Where(g => memberships.Select(m => m.GroupId).Contains(g.Id))
            .ToListAsync(ct);
        var byId = groups.ToDictionary(g => g.Id);

        var result = new List<GroupDto>();
        foreach (var m in memberships)
        {
            if (!byId.TryGetValue(m.GroupId, out var g)) continue;
            result.Add(await GroupDtoHelper.ToDtoAsync(db, g, user.Id, ct));
        }
        return result;
    }
}

// ---------- GetGroup ----------

public sealed record GetGroupQuery(Guid GroupId) : IRequest<GroupDto>;

public sealed class GetGroupHandler(IAppDbContext db, ICurrentUser user) : IRequestHandler<GetGroupQuery, GroupDto>
{
    public async Task<GroupDto> Handle(GetGroupQuery request, CancellationToken ct)
    {
        await EnsureMemberAsync(request.GroupId, ct);
        var group = await db.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == request.GroupId, ct)
            ?? throw new NotFoundException("Không tìm thấy nhóm");
        return await GroupDtoHelper.ToDtoAsync(db, group, user.Id, ct);
    }

    internal async Task EnsureMemberAsync(Guid groupId, CancellationToken ct)
    {
        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == groupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");
    }

    internal async Task EnsureOwnerAsync(Guid groupId, CancellationToken ct)
    {
        var m = await db.GroupMembers.AsNoTracking().FirstOrDefaultAsync(x => x.GroupId == groupId && x.UserId == user.Id, ct)
            ?? throw new UnauthorizedException("Bạn không phải thành viên của nhóm");
        if (m.Role != MemberRole.Owner) throw new UnauthorizedException("Chỉ chủ nhóm mới được thực hiện thao tác này");
    }
}

// ---------- UpdatePenaltyTiers ----------

public sealed class UpdatePenaltyTiersValidator : AbstractValidator<UpdatePenaltyTiersCommand>
{
    public UpdatePenaltyTiersValidator()
    {
        RuleFor(x => x.Tiers).NotNull().WithMessage("Thiếu bảng bậc phạt");
        RuleFor(x => x.ExtraPerActivity).GreaterThan(0).WithMessage("Mức phạt thêm phải > 0");
    }
}

public sealed class UpdatePenaltyTiersHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<UpdatePenaltyTiersCommand, GroupDto>
{
    public async Task<GroupDto> Handle(UpdatePenaltyTiersCommand cmd, CancellationToken ct)
    {
        if (cmd.Tiers.Length < 2 || cmd.Tiers[0] != 0)
            throw new Common.ValidationException(new Dictionary<string, string[]>
            {
                ["Tiers"] = ["Bậc phạt phải có tối thiểu 2 mức và bậc 0 = 0"]
            });
        for (var i = 1; i < cmd.Tiers.Length; i++)
            if (cmd.Tiers[i] <= cmd.Tiers[i - 1])
                throw new Common.ValidationException(new Dictionary<string, string[]>
                {
                    ["Tiers"] = ["Các bậc phạt phải tăng dần"]
                });

        var group = await db.Groups.FirstAsync(g => g.Id == cmd.GroupId, ct)
            ?? throw new NotFoundException("Không tìm thấy nhóm");
        var m = await db.GroupMembers.AsNoTracking().FirstAsync(x => x.GroupId == group.Id && x.UserId == user.Id, ct)
            ?? throw new UnauthorizedException("Bạn không phải thành viên của nhóm");
        if (m.Role != MemberRole.Owner)
            throw new UnauthorizedException("Chỉ chủ nhóm mới được chỉnh cấu hình phạt");

        group.PenaltyTiers = new PenaltyTiers(cmd.Tiers, cmd.ExtraPerActivity);
        await db.SaveChangesAsync(ct);
        return await GroupDtoHelper.ToDtoAsync(db, group, user.Id, ct);
    }
}

// ---------- RemoveMember ----------

public sealed class RemoveMemberHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<RemoveMemberCommand, bool>
{
    public async Task<bool> Handle(RemoveMemberCommand cmd, CancellationToken ct)
    {
        var m = await db.GroupMembers.AsNoTracking().FirstOrDefaultAsync(x => x.GroupId == cmd.GroupId && x.UserId == user.Id, ct)
            ?? throw new UnauthorizedException("Bạn không phải thành viên của nhóm");
        if (m.Role != MemberRole.Owner)
            throw new UnauthorizedException("Chỉ chủ nhóm mới được xoá thành viên");
        if (cmd.UserId == user.Id)
            throw new BusinessRuleException("Không thể xoá chính mình");

        var target = await db.GroupMembers.FirstAsync(x => x.GroupId == cmd.GroupId && x.UserId == cmd.UserId, ct)
            ?? throw new NotFoundException("Thành viên không tồn tại");
        if (target.Role == MemberRole.Owner)
            throw new BusinessRuleException("Không thể xoá chủ nhóm");

        db.GroupMembers.Remove(target);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
