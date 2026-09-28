using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Services;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Reviews;

// ---------- Proof feed ----------

public sealed record GetProofFeedQuery(Guid GroupId, string? Date, string? Status) : IRequest<ProofFeedDto>;

public sealed class GetProofFeedHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<GetProofFeedQuery, ProofFeedDto>
{
    public async Task<ProofFeedDto> Handle(GetProofFeedQuery request, CancellationToken ct)
    {
        var tz = clock.LocalTimeZone;

        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == request.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        var date = clock.TodayLocal;
        if (!string.IsNullOrWhiteSpace(request.Date))
        {
            if (!DateOnly.TryParse(request.Date, out date))
                throw new Common.ValidationException(new Dictionary<string, string[]>
                {
                    ["Date"] = ["date không hợp lệ (yyyy-MM-dd)"]
                });
        }

        var checkins = await db.CheckIns.AsNoTracking()
            .Include(c => c.Activity).ThenInclude(a => a!.Challenge)
            .Include(c => c.CheckinMedia)
            .Include(c => c.CheckoutMedia)
            .Include(c => c.User)
            .Where(c => c.LocalDate == date && c.Activity.Challenge.GroupId == request.GroupId)
            .OrderByDescending(c => c.CheckinAt)
            .ToListAsync(ct);

        var checkinIds = checkins.Select(c => c.Id).ToList();
        var reviews = await db.ProofReviews.AsNoTracking()
            .Include(r => r.Reviewer)
            .Where(r => checkinIds.Contains(r.CheckinId))
            .ToListAsync(ct);

        string? finalizeAt = null;
        var hasProvisional = await db.DailyResults.AnyAsync(d =>
            d.Challenge.GroupId == request.GroupId && d.LocalDate == date && d.Status == ResultStatus.Provisional, ct);
        if (hasProvisional)
        {
            var finalizeInstant = Domain.Services.ActivityEvaluator.ToInstant(
                date.AddDays(1), TimeOnly.FromTimeSpan(TimeSpan.FromHours(12)), tz);
            finalizeAt = Fmt.Iso(finalizeInstant);
        }

        var items = checkins.Select(c =>
        {
            var mine = reviews.Where(r => r.CheckinId == c.Id).ToList();
            var reports = mine.Where(r => r.Action == ProofReviewAction.Report)
                .Select(r => new ProofReportDto(r.Reason ?? "", r.Reviewer?.DisplayName ?? "Unknown",
                    Fmt.Iso(r.CreatedAt)!)).ToList();
            var lastDecision = mine
                .Where(r => r.Action is ProofReviewAction.Approve or ProofReviewAction.Reject)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefault();
            var review = lastDecision is null ? null : new ProofReviewDto(
                lastDecision.Action.ToString().ToUpperInvariant(),
                lastDecision.Reason,
                lastDecision.Reviewer?.DisplayName ?? "Unknown",
                Fmt.Iso(lastDecision.CreatedAt)!);

            return (Checkin: c, Reports: reports, Review: review);
        }).Where(x =>
        {
            var s = (request.Status ?? "ALL").Trim().ToUpperInvariant();
            switch (s)
            {
                case "REPORTED": return x.Reports.Count > 0;
                case "REJECTED": return x.Checkin.Status == CheckInStatus.Rejected;
                case "APPROVED":
                    return x.Review is not null && x.Review.Action == "APPROVE"
                    && x.Checkin.Status != CheckInStatus.Rejected;
                case "PENDING":
                    return x.Reports.Count == 0 && x.Review is null
                    && x.Checkin.Status != CheckInStatus.Rejected;
                default: return true;
            }
        }).Select(x =>
        {
            var c = x.Checkin;
            return new ProofFeedItemDto(
                c.ToDto(c.Activity?.Name ?? "", c.Activity?.Icon),
                new ProofUserDto(c.UserId.ToString(), c.User?.DisplayName ?? "Unknown", c.User?.AvatarUrl),
                new ProofActivityDto(c.Activity?.Name ?? "", c.Activity?.Icon, c.Activity?.Type ?? ActivityType.Deadline),
                new ProofChallengeDto(c.Activity?.ChallengeId.ToString() ?? "",
                    c.Activity?.Challenge?.Title ?? "", c.Activity?.Challenge?.Status ?? ChallengeStatus.Active),
                x.Reports,
                x.Review);
        }).ToList();

        return new ProofFeedDto(Fmt.Date(date), finalizeAt, items);
    }
}

// ---------- Report ----------

public sealed class ReportProofValidator : AbstractValidator<ReportProofCommand>
{
    public ReportProofValidator()
    {
        RuleFor(x => x.CheckinId).NotEmpty().WithMessage("Thiếu checkinId");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Thiếu lý do báo cáo").MaximumLength(500);
    }
}

public sealed class ReportProofHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<ReportProofCommand, bool>
{
    public async Task<bool> Handle(ReportProofCommand cmd, CancellationToken ct)
    {
        var checkin = await LoadGroupCheckInAsync(cmd.CheckinId, ct)
            ?? throw new NotFoundException("Không tìm thấy check-in");

        await EnsureNotFinalizedAsync(checkin.Activity!.ChallengeId, checkin.LocalDate, ct);

        var exists = await db.ProofReviews.AnyAsync(r =>
            r.CheckinId == checkin.Id && r.ReviewerId == user.Id && r.Action == ProofReviewAction.Report, ct);
        if (!exists)
        {
            db.ProofReviews.Add(new ProofReview
            {
                CheckinId = checkin.Id,
                ReviewerId = user.Id,
                Action = ProofReviewAction.Report,
                Reason = cmd.Reason.Trim(),
                CreatedAt = clock.UtcNow
            });
            await db.SaveChangesAsync(ct);
        }
        return true;
    }

    private async Task<CheckIn?> LoadGroupCheckInAsync(Guid checkinId, CancellationToken ct)
    {
        var c = await db.CheckIns.AsNoTracking()
            .Include(x => x.Activity).ThenInclude(a => a!.Challenge)
            .FirstOrDefaultAsync(x => x.Id == checkinId, ct);
        if (c?.Activity?.Challenge is null) return null;
        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == c.Activity.Challenge.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");
        return c;
    }

    private async Task EnsureNotFinalizedAsync(Guid challengeId, DateOnly date, CancellationToken ct)
    {
        var finalized = await db.DailyResults.AnyAsync(d =>
            d.ChallengeId == challengeId && d.LocalDate == date && d.Status == ResultStatus.Final, ct);
        if (finalized)
            throw new BusinessRuleException("Kết quả ngày đã chốt, không thể thay đổi");
    }
}

// ---------- Approve / Reject ----------

public sealed record ApproveProofCommand(Guid CheckinId, string? Reason) : IRequest<bool>;

public abstract class ReviewProofBaseHandler(
    IAppDbContext db, ICurrentUser user, IClock clock, IRealtimeNotifier realtime, ISettlementService settlement)
{
    protected async Task<(CheckIn, Challenge)> LoadAndAuthorizeAsync(Guid checkinId, bool approved, CancellationToken ct)
    {
        var checkin = await db.CheckIns
            .Include(c => c.Activity).ThenInclude(a => a!.Challenge)
            .FirstOrDefaultAsync(c => c.Id == checkinId, ct)
            ?? throw new NotFoundException("Không tìm thấy check-in");
        var challenge = checkin.Activity!.Challenge!;

        var myRole = await db.GroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.GroupId == challenge.GroupId && m.UserId == user.Id, ct)
            ?? throw new UnauthorizedException("Bạn không phải thành viên của nhóm");
        if (myRole.Role is not (MemberRole.Owner or MemberRole.Admin))
            throw new UnauthorizedException("Chỉ chủ nhóm / quản trị viên mới được duyệt bằng chứng");

        var finalized = await db.DailyResults.AnyAsync(d =>
            d.ChallengeId == challenge.Id && d.LocalDate == checkin.LocalDate && d.Status == ResultStatus.Final, ct);
        if (finalized)
            throw new BusinessRuleException("Kết quả ngày đã chốt, không thể thay đổi");

        return (checkin, challenge);
    }

    protected async Task<bool> RecordAsync(CheckIn checkin, Challenge challenge, bool approved, string? reason, CancellationToken ct)
    {
        var action = approved ? ProofReviewAction.Approve : ProofReviewAction.Reject;
        var existing = await db.ProofReviews.FirstOrDefaultAsync(r =>
            r.CheckinId == checkin.Id && r.ReviewerId == user.Id
            && r.Action != ProofReviewAction.Report, ct);
        if (existing is null)
        {
            db.ProofReviews.Add(new ProofReview
            {
                CheckinId = checkin.Id,
                ReviewerId = user.Id,
                Action = action,
                Reason = reason,
                CreatedAt = clock.UtcNow
            });
        }
        else
        {
            existing.Action = action;
            existing.Reason = reason;
            existing.CreatedAt = clock.UtcNow;
        }

        if (!approved)
        {
            checkin.Status = CheckInStatus.Rejected;
            await db.SaveChangesAsync(ct);

            await settlement.SettleChallengeDayAsync(challenge.Id, checkin.LocalDate, ct);
            await realtime.GroupAsync(challenge.GroupId, EventNames.ProofRejected,
                new ProofRejectedEvent(checkin.Id.ToString(), user.Id.ToString(), reason), ct);
        }
        else
        {
            await db.SaveChangesAsync(ct);
        }

        return true;
    }
}

public sealed class ApproveProofHandler(
    IAppDbContext db, ICurrentUser user, IClock clock, IRealtimeNotifier realtime, ISettlementService settlement)
    : ReviewProofBaseHandler(db, user, clock, realtime, settlement), IRequestHandler<ApproveProofCommand, bool>
{
    public async Task<bool> Handle(ApproveProofCommand cmd, CancellationToken ct)
    {
        var (checkin, challenge) = await LoadAndAuthorizeAsync(cmd.CheckinId, true, ct);
        return await RecordAsync(checkin, challenge, true, cmd.Reason, ct);
    }
}

public sealed class RejectProofHandler(
    IAppDbContext db, ICurrentUser user, IClock clock, IRealtimeNotifier realtime, ISettlementService settlement)
    : ReviewProofBaseHandler(db, user, clock, realtime, settlement), IRequestHandler<RejectProofCommand, bool>
{
    public async Task<bool> Handle(RejectProofCommand cmd, CancellationToken ct)
    {
        var (checkin, challenge) = await LoadAndAuthorizeAsync(cmd.CheckinId, false, ct);
        return await RecordAsync(checkin, challenge, false, cmd.Reason, ct);
    }
}
