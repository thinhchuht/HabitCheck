using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Challenges;

/// <summary>Kiểm tra quyền truy cập challenge dùng chung cho các handler.</summary>
public static class ChallengeAccess
{
    /// Thành viên nhóm của challenge (xem) hoặc chủ challenge (sửa).
    public static async Task<Challenge> EnsureCanAccessAsync(IAppDbContext db, ICurrentUser user, Guid challengeId, bool asOwner, CancellationToken ct)
    {
        var ch = await db.Challenges.AsNoTracking().FirstOrDefaultAsync(c => c.Id == challengeId, ct)
            ?? throw new NotFoundException("Không tìm thấy kỳ thử thách");

        bool ok;
        if (asOwner)
            ok = ch.UserId == user.Id;
        else
            ok = await db.GroupMembers.AnyAsync(m => m.GroupId == ch.GroupId && m.UserId == user.Id, ct);

        if (!ok) throw new UnauthorizedException("Bạn không có quyền truy cập kỳ thử thách này");
        return ch;
    }

    public static async Task<Challenge> EnsureDraftAsync(IAppDbContext db, ICurrentUser user, Guid challengeId, CancellationToken ct)
    {
        var ch = await db.Challenges.FirstOrDefaultAsync(c => c.Id == challengeId, ct)
            ?? throw new NotFoundException("Không tìm thấy kỳ thử thách");
        if (ch.UserId != user.Id) throw new UnauthorizedException("Không phải chủ của kỳ thử thách này");
        if (ch.Status != ChallengeStatus.Draft)
            throw new BusinessRuleException("Kỳ thử thách đã khoá, không thể sửa");
        return ch;
    }

    /// DRAFT đã đến hạn (today >= StartDate) → kích hoạt ACTIVE + khoá.
    /// Yêu cầu entity đã được EF tracking. Chỉ lưu khi có chuyển trạng thái.
    public static async Task ActivateIfDueAsync(IAppDbContext db, Challenge ch, DateOnly today, DateTimeOffset now, CancellationToken ct)
    {
        if (ch.Status == ChallengeStatus.Draft && today >= ch.StartDate)
        {
            ch.Status = ChallengeStatus.Active;
            ch.LockedAt = now;
            await db.SaveChangesAsync(ct);
        }
    }
}
