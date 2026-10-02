using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.CheatDays;

public sealed record CheatDayDto(string Id, string GroupId, string LocalDate, string CreatedAt);

/// <summary>Đánh dấu cheat day: hôm nay hoặc tối đa 7 ngày tới, 1/tuần (T2–CN) cho mỗi (user, nhóm). Đã đánh dấu thì không huỷ được.</summary>
public sealed record MarkCheatDayCommand(Guid GroupId, string? Date) : IRequest<CheatDayDto>;

public sealed class MarkCheatDayHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<MarkCheatDayCommand, CheatDayDto>
{
    public async Task<CheatDayDto> Handle(MarkCheatDayCommand request, CancellationToken ct)
    {
        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == request.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        var today = clock.TodayLocal;
        var date = string.IsNullOrWhiteSpace(request.Date)
            ? today
            : DateOnly.TryParse(request.Date, out var d) ? d : throw new BusinessRuleException("Ngày không hợp lệ");

        if (date < today) throw new BusinessRuleException("Không thể đánh dấu cheat day cho ngày đã qua");
        if (date > today.AddDays(7)) throw new BusinessRuleException("Chỉ có thể đánh dấu cheat day tối đa 7 ngày tới");

        var existing = await db.CheatDays.FirstOrDefaultAsync(c =>
            c.UserId == user.Id && c.GroupId == request.GroupId && c.LocalDate == date, ct);
        if (existing is not null) throw new BusinessRuleException("Ngày này đã được đánh dấu cheat day rồi");

        // Tuần ISO (T2–CN): mỗi user trong mỗi nhóm tối đa 1 cheat day
        var weekStart = date.AddDays(-(int)date.DayOfWeek);
        var usedThisWeek = await db.CheatDays.AnyAsync(c =>
            c.UserId == user.Id && c.GroupId == request.GroupId
            && c.LocalDate >= weekStart && c.LocalDate <= weekStart.AddDays(6), ct);
        if (usedThisWeek) throw new BusinessRuleException("Tuần này bạn đã dùng 1 cheat day rồi");

        var cheatDay = new CheatDay
        {
            UserId = user.Id,
            GroupId = request.GroupId,
            LocalDate = date,
            CreatedAt = clock.UtcNow
        };
        db.CheatDays.Add(cheatDay);
        await db.SaveChangesAsync(ct);

        return new CheatDayDto(
            cheatDay.Id.ToString(),
            request.GroupId.ToString(),
            Fmt.Date(cheatDay.LocalDate),
            Fmt.Iso(cheatDay.CreatedAt));
    }
}
