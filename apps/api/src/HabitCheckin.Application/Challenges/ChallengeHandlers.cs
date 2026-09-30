using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Challenges;

// ---------- CreateChallenge ----------

public sealed class CreateChallengeValidator : AbstractValidator<CreateChallengeCommand>
{
    public CreateChallengeValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Thiếu tiêu đề").MaximumLength(200);
        RuleFor(x => x.StartDate).NotEmpty().WithMessage("Thiếu ngày bắt đầu");
        RuleFor(x => x.EndDate).NotEmpty().WithMessage("Thiếu ngày kết thúc");
        RuleFor(x => x.EndDate)
            .GreaterThan(x => x.StartDate == null ? "" : x.StartDate)
            .WithMessage("Ngày kết thúc phải sau ngày bắt đầu")
            .When(x => x.StartDate is not null && x.EndDate is not null);
    }
}

public sealed class CreateChallengeHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<CreateChallengeCommand, ChallengeDto>
{
    public async Task<ChallengeDto> Handle(CreateChallengeCommand cmd, CancellationToken ct)
    {
        var startDate = ParseDate(cmd.StartDate, "startDate");
        var endDate = ParseDate(cmd.EndDate, "endDate");

        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == cmd.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        var hasActive = await db.Challenges.AnyAsync(c =>
            c.UserId == user.Id && c.GroupId == cmd.GroupId && c.Status == ChallengeStatus.Active, ct);
        if (hasActive) throw new BusinessRuleException("Bạn đã có một kỳ thử thách đang diễn ra trong nhóm này");

        var overlaps = await db.Challenges.AnyAsync(c =>
            c.UserId == user.Id && c.GroupId == cmd.GroupId
            && c.Status != ChallengeStatus.Cancelled
            && c.StartDate <= endDate && c.EndDate >= startDate, ct);
        if (overlaps) throw new BusinessRuleException("Kỳ thử thách này bị chồng ngày với một kỳ khác");

        // Luôn tạo ở DRAFT — kể cả start_date = hôm nay — để user kịp thêm hoạt động
        // trước khi kỳ khoá. Kích hoạt ACTIVE khi dùng (GetToday/CheckIn) hoặc job 00:00.
        var challenge = new Challenge
        {
            GroupId = cmd.GroupId,
            UserId = user.Id,
            Title = cmd.Title.Trim(),
            StartDate = startDate,
            EndDate = endDate,
            Status = ChallengeStatus.Draft,
            LockedAt = null,
            CreatedAt = clock.UtcNow
        };
        db.Challenges.Add(challenge);
        await db.SaveChangesAsync(ct);
        var ownerName = await db.Users.AsNoTracking()
            .Where(u => u.Id == user.Id).Select(u => u.DisplayName).FirstAsync(ct);
        return challenge.ToDto(ownerName, new List<Activity>());
    }

    internal static async Task<string> OwnerNameAsync(IAppDbContext db, Guid userId, CancellationToken ct) =>
        await db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.DisplayName).FirstAsync(ct);

    internal static DateOnly ParseDate(string? value, string name)
    {
        if (string.IsNullOrWhiteSpace(value) || !DateOnly.TryParse(value, out var d))
            throw new Common.ValidationException(new Dictionary<string, string[]>
            {
                [name] = [$"{name} không hợp lệ, định dạng yyyy-MM-dd"]
            });
        return d;
    }
}

// ---------- GetMyChallenges ----------

public sealed record GetMyChallengesQuery(Guid GroupId) : IRequest<List<ChallengeDto>>;

public sealed class GetMyChallengesHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<GetMyChallengesQuery, List<ChallengeDto>>
{
    public async Task<List<ChallengeDto>> Handle(GetMyChallengesQuery request, CancellationToken ct)
    {
        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == request.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        var list = await db.Challenges.AsNoTracking()
            .Include(c => c.Activities)
            .Where(c => c.UserId == user.Id && c.GroupId == request.GroupId)
            .OrderByDescending(c => c.StartDate)
            .ToListAsync(ct);
        foreach (var c in list)
            c.Activities.Sort((a, b) => a.SortOrder.CompareTo(b.SortOrder));
        var ownerName = await CreateChallengeHandler.OwnerNameAsync(db, user.Id, ct);
        return list.Select(c => c.ToDto(ownerName, c.Activities)).ToList();
    }
}

// ---------- GetGroupChallenges (xem kỳ của mọi thành viên trong nhóm) ----------

public sealed record GetGroupChallengesQuery(Guid GroupId) : IRequest<List<ChallengeDto>>;

public sealed class GetGroupChallengesHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<GetGroupChallengesQuery, List<ChallengeDto>>
{
    public async Task<List<ChallengeDto>> Handle(GetGroupChallengesQuery request, CancellationToken ct)
    {
        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == request.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        // ACTIVE trước, rồi DRAFT, sau đó COMPLETED — cùng nhóm trạng thái thì kỳ bắt đầu muộn hơn lên trước.
        var list = await db.Challenges.AsNoTracking()
            .Include(c => c.Activities)
            .Where(c => c.GroupId == request.GroupId)
            .OrderBy(c => c.Status == ChallengeStatus.Active ? 0 : c.Status == ChallengeStatus.Draft ? 1 : 2)
            .ThenByDescending(c => c.StartDate)
            .ToListAsync(ct);
        foreach (var c in list)
            c.Activities.Sort((a, b) => a.SortOrder.CompareTo(b.SortOrder));

        var ownerIds = list.Select(c => c.UserId).Distinct().ToList();
        var names = await db.Users.AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);
        return list
            .Select(c => c.ToDto(names.TryGetValue(c.UserId, out var n) ? n : "…", c.Activities))
            .ToList();
    }
}

// ---------- GetChallenge (thành viên nhóm xem được challenge của người khác) ----------

public sealed record GetChallengeQuery(Guid Id) : IRequest<ChallengeDto>;

public sealed class GetChallengeHandler(IAppDbContext db, ICurrentUser user) : IRequestHandler<GetChallengeQuery, ChallengeDto>
{
    public async Task<ChallengeDto> Handle(GetChallengeQuery request, CancellationToken ct)
    {
        var ch = await db.Challenges.AsNoTracking()
            .Include(c => c.Activities)
            .FirstOrDefaultAsync(c => c.Id == request.Id, ct)
            ?? throw new NotFoundException("Không tìm thấy kỳ thử thách");
        ch.Activities.Sort((a, b) => a.SortOrder.CompareTo(b.SortOrder));
        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == ch.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");
        var ownerName = await CreateChallengeHandler.OwnerNameAsync(db, ch.UserId, ct);
        return ch.ToDto(ownerName, ch.Activities);
    }
}

// ---------- UpdateChallenge (chỉ DRAFT) ----------

public sealed class UpdateChallengeHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<UpdateChallengeCommand, ChallengeDto>
{
    public async Task<ChallengeDto> Handle(UpdateChallengeCommand cmd, CancellationToken ct)
    {
        var ch = await ChallengeAccess.EnsureDraftAsync(db, user, cmd.Id, ct);

        if (!string.IsNullOrWhiteSpace(cmd.Title))
            ch.Title = cmd.Title!.Trim();
        if (!string.IsNullOrWhiteSpace(cmd.StartDate))
            ch.StartDate = CreateChallengeHandler.ParseDate(cmd.StartDate, "startDate");
        if (!string.IsNullOrWhiteSpace(cmd.EndDate))
            ch.EndDate = CreateChallengeHandler.ParseDate(cmd.EndDate, "endDate");

        if (ch.EndDate < ch.StartDate)
            throw new BusinessRuleException("Ngày kết thúc phải sau ngày bắt đầu");

        await db.SaveChangesAsync(ct);
        var activities = await db.Activities.AsNoTracking()
            .Where(a => a.ChallengeId == ch.Id).ToListAsync(ct);
        var ownerName = await CreateChallengeHandler.OwnerNameAsync(db, user.Id, ct);
        return ch.ToDto(ownerName, activities);
    }
}

// ---------- DeleteChallenge (hoá CANCELLED khi DRAFT) ----------

public sealed record DeleteChallengeCommand(Guid Id) : IRequest<bool>;

public sealed class DeleteChallengeHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<DeleteChallengeCommand, bool>
{
    public async Task<bool> Handle(DeleteChallengeCommand cmd, CancellationToken ct)
    {
        var ch = await ChallengeAccess.EnsureDraftAsync(db, user, cmd.Id, ct);
        ch.Status = ChallengeStatus.Cancelled;
        ch.LockedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }
}
