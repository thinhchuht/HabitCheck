using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.CheckIns;

/// <summary>
/// Cấp chữ ký Cloudinary cho upload bằng chứng.
/// CHECKIN: bắt buộc; CHECKOUT: chỉ cho DURATION đang có phiên OPEN.
/// </summary>
public sealed class CreateUploadIntentHandler(IAppDbContext db, ICurrentUser user, IClock clock, IMediaStorage media)
    : IRequestHandler<CreateUploadIntentCommand, UploadIntentDto>
{
    public async Task<UploadIntentDto> Handle(CreateUploadIntentCommand cmd, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var today = clock.TodayLocal;

        var activity = await db.Activities.AsNoTracking()
            .Include(a => a.Challenge)
            .FirstOrDefaultAsync(a => a.Id == cmd.ActivityId, ct)
            ?? throw new NotFoundException("Không tìm thấy hoạt động");

        if (activity.Challenge.UserId != user.Id)
            throw new UnauthorizedException("Hoạt động không thuộc về bạn");

        var ch = activity.Challenge;
        if (ch.Status != ChallengeStatus.Active || today < ch.StartDate || today > ch.EndDate)
            throw new BusinessRuleException("Kỳ thử thách không hoạt động hôm nay");

        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == ch.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        UploadIntentKind kind;
        if (string.Equals(cmd.Kind, "CHECKIN", StringComparison.OrdinalIgnoreCase))
            kind = UploadIntentKind.CheckIn;
        else if (string.Equals(cmd.Kind, "CHECKOUT", StringComparison.OrdinalIgnoreCase))
        {
            kind = UploadIntentKind.CheckOut;
            if (activity.Type != ActivityType.Duration)
                throw new BusinessRuleException("Chỉ hoạt động thời lượng mới có check-out");
            var hasOpen = await db.CheckIns.AnyAsync(c =>
                c.ActivityId == activity.Id && c.UserId == user.Id
                && c.LocalDate == today && c.Status == CheckInStatus.Open, ct);
            if (!hasOpen) throw new BusinessRuleException("Không có phiên nào đang mở để check-out");
        }
        else
            throw new BusinessRuleException("Loại upload không hợp lệ");

        if (kind == UploadIntentKind.CheckIn)
        {
            var alreadyDone = await db.CheckIns.AnyAsync(c =>
                c.ActivityId == activity.Id && c.UserId == user.Id
                && c.LocalDate == today && c.Status != CheckInStatus.Rejected, ct);
            if (alreadyDone)
                throw new ConflictException("Hoạt động đã có check-in trong ngày, không thể check-in lại");
        }

        var intent = new UploadIntent
        {
            UserId = user.Id,
            ActivityId = activity.Id,
            Kind = kind,
            IntentAt = now,
            ExpiresAt = now.AddMinutes(15)
        };
        db.UploadIntents.Add(intent);
        await db.SaveChangesAsync(ct);

        var sig = await media.SignProofAsync(ch.GroupId, user.Id, today, activity.ProofType, intent.Id, ct);
        return ToDto(intent, sig);
    }

    private static UploadIntentDto ToDto(UploadIntent intent, UploadSignature sig) => new(
        intent.Id.ToString(), Fmt.Iso(intent.ExpiresAt)!,
        new UploadSignatureDto(sig.CloudName, sig.ApiKey, sig.UploadPreset, sig.Folder, sig.PublicId, sig.Timestamp, sig.Signature, sig.AllowedTypes));
}
