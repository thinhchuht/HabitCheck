using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Challenges;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.CheckIns;

// ---------- CheckIn ----------

public sealed class CheckInValidator : AbstractValidator<CheckInCommand>
{
    public CheckInValidator()
    {
        RuleFor(x => x.ActivityId).NotEmpty().WithMessage("Thiếu activityId");
        RuleFor(x => x.IntentId).NotEmpty().WithMessage("Thiếu intentId");
        RuleFor(x => x.PublicId).NotEmpty().WithMessage("Thiếu publicId");
        RuleFor(x => x.Note).MaximumLength(500).When(x => x.Note is not null);
    }
}

public sealed class CheckInHandler(
    IAppDbContext db, ICurrentUser user, IClock clock, IMediaStorage media, IRealtimeNotifier realtime)
    : IRequestHandler<CheckInCommand, CheckInDto>
{
    public async Task<CheckInDto> Handle(CheckInCommand cmd, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var today = clock.TodayLocal;

        var activity = await db.Activities.AsNoTracking()
            .Include(a => a.Challenge)
            .SingleAsync(a => a.Id == cmd.ActivityId && a.Challenge.UserId == user.Id, ct)
            ?? throw new NotFoundException("Không tìm thấy hoạt động");

        if (today < activity.Challenge!.StartDate || today > activity.Challenge.EndDate)
            throw new BusinessRuleException("Kỳ thử thách không hoạt động hôm nay");

        // Tải challenge dạng tracked (kèm Activities) để có thể kích hoạt DRAFT
        // đã đến hạn tại chỗ — kỳ rỗng vẫn DRAFT (ActivateIfDueAsync kiểm tra số hoạt động).
        var ch = await db.Challenges.Include(c => c.Activities)
            .FirstOrDefaultAsync(c => c.Id == activity.ChallengeId, ct)
            ?? throw new NotFoundException("Không tìm thấy kỳ thử thách");
        await ChallengeAccess.ActivateIfDueAsync(db, ch, today, now, ct);
        if (ch.Status != ChallengeStatus.Active)
            throw new BusinessRuleException("Kỳ thử thách không hoạt động hôm nay");

        // Tải intent TRƯỚC khi validate cửa sổ: cửa sổ validate theo intent_at
        // (thời điểm bắt đầu check-in) chứ không theo giờ server nhận request —
        // upload chậm (mạng yếu) không bị tính trễ oan (§1.3: checkin_at = intent_at,
        // media hoàn tất upload trong 15 phút sau intent).
        var intent = await db.UploadIntents.FirstOrDefaultAsync(i =>
            i.Id == cmd.IntentId && i.UserId == user.Id && i.ActivityId == activity.Id
            && i.Kind == UploadIntentKind.CheckIn && i.UsedAt == null && i.ExpiresAt > now, ct)
            ?? throw new BusinessRuleException("Upload intent không hợp lệ hoặc đã hết hạn");

        // DEADLINE: chỉ nhận check-in trong cửa sổ [mốc − 2h, mốc + 10 phút] của MỘT ngày
        // (tính trên DateTimeOffset để mốc sớm không tràn TimeOnly khi lùi cửa sổ sang ngày trước).
        // Mốc sớm (< 02:00, VD 0:00) neo sang ngày hôm sau: cửa sổ của ngày X là [X 22:00 → X+1 00:10],
        // check-in tối ngày X tính cho ngày X; 10 phút đầu sau 0:00 thuộc cửa sổ của ngày trước.
        // Mốc muộn (VD 23:55) phần grace sau 0:00 cũng thuộc cửa sổ của ngày trước.
        // Mỗi thời điểm chỉ rơi vào đúng 1 cửa sổ (cửa sổ các ngày liên tiếp không giao nhau)
        // → dò 2 ứng viên: ngày của intent_at, rồi ngày trước đó.
        DateOnly targetDay = today;
        if (activity.Type == ActivityType.Deadline && activity.DeadlineTime is TimeOnly dl)
        {
            var tAt = intent.IntentAt;
            var intentDay = clock.ToLocalDate(tAt);
            var (winStart, winEnd) = Domain.Services.ActivityEvaluator.DeadlineWindow(intentDay, dl, clock.LocalTimeZone);
            if (tAt >= winStart && tAt <= winEnd)
            {
                targetDay = intentDay;
            }
            else
            {
                var (prevStart, prevEnd) = Domain.Services.ActivityEvaluator.DeadlineWindow(
                    intentDay.AddDays(-1), dl, clock.LocalTimeZone);
                if (tAt >= prevStart && tAt <= prevEnd)
                {
                    targetDay = intentDay.AddDays(-1);
                }
                else if (tAt < winStart)
                {
                    throw new BusinessRuleException(
                        $"Chưa đến giờ check-in '{activity.Name}': chỉ nhận trong khoảng {winStart:HH:mm}–{winEnd:HH:mm} (sớm nhất 2 giờ trước mốc {dl:HH:mm}, muộn nhất 10 phút sau)");
                }
                else
                {
                    throw new BusinessRuleException(
                        $"Quá giờ check-in '{activity.Name}': chỉ nhận trong khoảng {winStart:HH:mm}–{winEnd:HH:mm} (sớm nhất 2 giờ trước mốc {dl:HH:mm}, muộn nhất 10 phút sau)");
                }
            }

            if (targetDay < ch.StartDate || targetDay > ch.EndDate)
                throw new BusinessRuleException("Kỳ thử thách không hoạt động trong ngày của lần check-in này");
        }

        var asset = await media.VerifyAssetAsync(cmd.PublicId, activity.ProofType, intent.IntentAt, ct);
        asset.UserId = user.Id;

        var alreadyDone = await db.CheckIns.AnyAsync(c =>
            c.ActivityId == activity.Id && c.UserId == user.Id
            && c.LocalDate == targetDay && c.Status != CheckInStatus.Rejected, ct);
        if (alreadyDone)
            throw new ConflictException("Hoạt động đã có check-in hợp lệ trong ngày");

        var checkinAt = intent.IntentAt;
        var checkin = new CheckIn
        {
            ActivityId = activity.Id,
            UserId = user.Id,
            LocalDate = targetDay,
            CheckinAt = checkinAt,
            CheckinMediaId = asset.Id,
            Note = string.IsNullOrWhiteSpace(cmd.Note) ? null : cmd.Note.Trim(),
            Status = CheckInStatus.Completed,
            // Bắt buộc gán — không gán thì EF ghi CLR default 0001-01-01 (UI hiện "01/01 07:06").
            CreatedAt = now
        };

        var isLate = false;
        if (activity.Type == ActivityType.Deadline && activity.DeadlineTime is TimeOnly t)
        {
            // "Trễ" = sau mốc giờ (vẫn PASS nếu trong cửa sổ +10 phút).
            var deadline = Domain.Services.ActivityEvaluator.DeadlineAnchor(targetDay, t, clock.LocalTimeZone);
            isLate = checkinAt > deadline;
        }

        db.CheckIns.Add(checkin);
        db.MediaAssets.Add(asset);
        intent.UsedAt = now;
        await db.SaveChangesAsync(ct);

        var thumb = asset.ThumbnailUrl ?? asset.SecureUrl;
        await realtime.GroupAsync(ch.GroupId, EventNames.CheckInCreated,
            new CheckInCreatedEvent(user.Id.ToString(), activity.Id.ToString(),
                activity.Name, checkinAt, isLate, thumb), ct);

        return checkin.ToDto(activity.Name, activity.Icon);
    }
}

// ---------- CheckOut ----------

public sealed class CheckOutValidator : AbstractValidator<CheckOutCommand>
{
    public CheckOutValidator()
    {
        RuleFor(x => x.CheckinId).NotEmpty().WithMessage("Thiếu checkinId");
        RuleFor(x => x.IntentId).NotEmpty().WithMessage("Thiếu intentId");
        RuleFor(x => x.PublicId).NotEmpty().WithMessage("Thiếu publicId");
    }
}

public sealed class CheckOutHandler(
    IAppDbContext db, ICurrentUser user, IClock clock, IMediaStorage media, IRealtimeNotifier realtime)
    : IRequestHandler<CheckOutCommand, CheckInDto>
{
    public async Task<CheckInDto> Handle(CheckOutCommand cmd, CancellationToken ct)
    {
        var now = clock.UtcNow;

        var checkin = await db.CheckIns.Include(c => c.Activity).ThenInclude(a => a!.Challenge)
            .FirstOrDefaultAsync(c => c.Id == cmd.CheckinId && c.UserId == user.Id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiên check-in");

        if (checkin.Status != CheckInStatus.Open)
            throw new BusinessRuleException("Phiên này không đang mở");

        var activity = checkin.Activity!;
        var intent = await db.UploadIntents.FirstOrDefaultAsync(i =>
            i.Id == cmd.IntentId && i.UserId == user.Id && i.ActivityId == activity.Id
            && i.Kind == UploadIntentKind.CheckOut && i.UsedAt == null && i.ExpiresAt > now, ct)
            ?? throw new BusinessRuleException("Upload intent không hợp lệ hoặc đã hết hạn");

        var asset = await media.VerifyAssetAsync(cmd.PublicId, activity.ProofType, intent.IntentAt, ct);
        asset.UserId = user.Id;

        var checkoutAt = intent.IntentAt;
        if (checkoutAt <= checkin.CheckinAt)
            throw new BusinessRuleException("Thời điểm check-out phải sau thời điểm check-in");

        var minutes = Math.Max(1, (int)Math.Ceiling((checkoutAt - checkin.CheckinAt).TotalMinutes));
        checkin.CheckoutAt = checkoutAt;
        checkin.CheckoutMediaId = asset.Id;
        checkin.DurationMinutes = minutes;
        checkin.Status = CheckInStatus.Completed;

        db.MediaAssets.Add(asset);
        intent.UsedAt = now;
        await db.SaveChangesAsync(ct);

        var totalToday = await db.CheckIns
            .Where(c => c.ActivityId == activity.Id && c.UserId == user.Id
                        && c.LocalDate == checkin.LocalDate && c.Status == CheckInStatus.Completed)
            .SumAsync(c => c.DurationMinutes ?? 0, ct);

        await realtime.GroupAsync(activity.Challenge.GroupId, EventNames.CheckOutCompleted,
            new CheckOutCompletedEvent(user.Id.ToString(), activity.Id.ToString(), minutes, totalToday), ct);

        return checkin.ToDto(activity.Name, activity.Icon);
    }
}

// ---------- History ----------

/// <summary>Lịch sử check-in. Xem của mình; xem người khác cùng nhóm được phép.</summary>
public sealed class GetCheckInsHandler(IAppDbContext db, ICurrentUser user)
    : IRequestHandler<GetCheckInsCommand, List<CheckInDto>>
{
    public async Task<List<CheckInDto>> Handle(GetCheckInsCommand cmd, CancellationToken ct)
    {
        Guid targetUser = user.Id;
        if (!string.IsNullOrWhiteSpace(cmd.UserId))
        {
            if (Guid.TryParse(cmd.UserId, out var parsed))
                targetUser = parsed;
            else
                throw new Common.ValidationException(new Dictionary<string, string[]>
                {
                    ["UserId"] = ["userId không hợp lệ"]
                });
        }

        if (targetUser != user.Id)
        {
            // Chỉ xem được người cùng nhóm: tìm chung 1 nhóm có cả hai
            var shared = await db.GroupMembers
                .Where(m => m.UserId == user.Id)
                .Select(m => m.GroupId)
                .Intersect(db.GroupMembers.Where(m => m.UserId == targetUser).Select(m => m.GroupId))
                .AnyAsync(ct);
            if (!shared)
                throw new UnauthorizedException("Chỉ xem được lịch sử của thành viên cùng nhóm");
        }

        DateOnly? date = null;
        if (!string.IsNullOrWhiteSpace(cmd.Date))
        {
            if (!DateOnly.TryParse(cmd.Date, out var d))
                throw new Common.ValidationException(new Dictionary<string, string[]>
                {
                    ["Date"] = ["date không hợp lệ (yyyy-MM-dd)"]
                });
            date = d;
        }

        var query = db.CheckIns.AsNoTracking()
            .Include(c => c.Activity)
            .Include(c => c.CheckinMedia)
            .Include(c => c.CheckoutMedia)
            .Where(c => c.UserId == targetUser
                        && (cmd.ActivityId == null || c.ActivityId == cmd.ActivityId.Value));
        if (date.HasValue)
            query = query.Where(c => c.LocalDate == date.Value);

        var list = await query.OrderByDescending(c => c.CheckinAt).Take(200).ToListAsync(ct);
        return list
            .Select(c => c.ToDto(c.Activity?.Name ?? "", c.Activity?.Icon))
            .ToList();
    }
}
