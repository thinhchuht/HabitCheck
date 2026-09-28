using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Fund;

// ---------- Fund overview ----------

public sealed record GetFundQuery(Guid GroupId) : IRequest<FundDto>;

public sealed class GetFundHandler(IAppDbContext db, ICurrentUser user) : IRequestHandler<GetFundQuery, FundDto>
{
    public async Task<FundDto> Handle(GetFundQuery request, CancellationToken ct)
    {
        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == request.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        var members = await db.GroupMembers.AsNoTracking()
            .Where(m => m.GroupId == request.GroupId)
            .ToListAsync(ct);
        var users = await db.Users.AsNoTracking()
            .Where(u => members.Select(m => m.UserId).Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        var challengeIds = await db.Challenges
            .Where(c => c.GroupId == request.GroupId && c.Status != ChallengeStatus.Cancelled)
            .Select(c => c.Id)
            .ToListAsync(ct);

        Dictionary<Guid, long> penalties = new();
        if (challengeIds.Count > 0)
        {
            var rows = await db.DailyResults.AsNoTracking()
                .Where(d => challengeIds.Contains(d.ChallengeId))
                .GroupBy(d => d.UserId)
                .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.PenaltyAmount) })
                .ToListAsync(ct);
            penalties = rows.ToDictionary(r => r.UserId, r => r.Total);
        }

        var paymentRows = await db.PenaltyLedger.AsNoTracking()
            .Where(l => l.GroupId == request.GroupId && l.Kind == LedgerKind.Payment)
            .GroupBy(l => l.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync(ct);
        var payments = paymentRows.ToDictionary(r => r.UserId, r => r.Total);

        var debts = members
            .Where(m => users.ContainsKey(m.UserId))
            .Select(m =>
            {
                var penalty = penalties.GetValueOrDefault(m.UserId);
                var paid = payments.GetValueOrDefault(m.UserId);
                return new FundDebtDto(m.UserId.ToString(), users[m.UserId].DisplayName,
                    users[m.UserId].AvatarUrl, penalty, paid, penalty - paid);
            })
            .OrderByDescending(d => d.Balance)
            .ToList();

        var history = await db.PenaltyLedger.AsNoTracking()
            .Include(l => l.User)
            .Include(l => l.CreatedByUser)
            .Where(l => l.GroupId == request.GroupId)
            .OrderByDescending(l => l.CreatedAt)
            .Take(200)
            .ToListAsync(ct);

        var historyDtos = history.Select(l => new FundHistoryDto(
            l.Id.ToString(),
            l.UserId.ToString(),
            l.User?.DisplayName ?? "Unknown",
            l.Amount,
            l.Kind,
            l.Note,
            null,
            l.CreatedByUser?.DisplayName,
            Fmt.Iso(l.CreatedAt)!))
            .ToList();

        var totalPenalty = penalties.Values.Sum();
        var totalPaid = payments.Values.Sum();

        return new FundDto(request.GroupId.ToString(), totalPenalty, totalPaid,
            totalPenalty - totalPaid, debts, historyDtos);
    }
}

// ---------- RecordPayment ----------

public sealed class RecordPaymentValidator : AbstractValidator<RecordPaymentCommand>
{
    public RecordPaymentValidator()
    {
        RuleFor(x => x.UserId).NotEmpty().WithMessage("Thiếu userId");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Số tiền phải > 0");
        RuleFor(x => x.Note).MaximumLength(500).When(x => x.Note is not null);
    }
}

public sealed class RecordPaymentHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<RecordPaymentCommand, LedgerEntryDto>
{
    public async Task<LedgerEntryDto> Handle(RecordPaymentCommand cmd, CancellationToken ct)
    {
        var m = await db.GroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.GroupId == cmd.GroupId && x.UserId == user.Id, ct)
            ?? throw new UnauthorizedException("Bạn không phải thành viên của nhóm");
        if (m.Role != MemberRole.Owner)
            throw new UnauthorizedException("Chỉ chủ nhóm mới được ghi nhận đóng tiền");

        var target = await db.GroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.GroupId == cmd.GroupId && x.UserId == cmd.UserId, ct)
            ?? throw new NotFoundException("Thành viên không tồn tại trong nhóm");

        var entry = new PenaltyLedgerEntry
        {
            GroupId = cmd.GroupId,
            UserId = cmd.UserId,
            Amount = cmd.Amount,
            Kind = LedgerKind.Payment,
            Note = string.IsNullOrWhiteSpace(cmd.Note) ? null : cmd.Note.Trim(),
            CreatedBy = user.Id,
            CreatedAt = clock.UtcNow
        };
        db.PenaltyLedger.Add(entry);
        await db.SaveChangesAsync(ct);

        return new LedgerEntryDto(entry.Id.ToString(), entry.Amount, entry.Kind, entry.Note, Fmt.Iso(entry.CreatedAt)!);
    }
}
