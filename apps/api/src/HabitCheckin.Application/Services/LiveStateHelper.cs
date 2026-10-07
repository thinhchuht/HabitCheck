using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Domain.Services;

namespace HabitCheckin.Application.Services;

/// <summary>
/// Xác định trạng thái "live" của activity trong ngày:
/// PASS (đã đạt) / PENDING (chưa fail, vẫn kịp) / FAIL (đã chắc chắn fail).
/// </summary>
public static class LiveStateHelper
{
    public const string Pass = "PASS";
    public const string Pending = "PENDING";
    public const string Fail = "FAIL";

    public static (string State, string? FailReason) Resolve(
        Activity a,
        ActivityEvaluation eval,
        IReadOnlyList<CheckIn> dayCheckins,
        DateOnly today,
        DateTimeOffset now,
        TimeZoneInfo tz)
    {
        if (eval.Passed) return (Pass, null);

        bool over = a.Type switch
        {
            // Mốc sớm (< 02:00) neo sang ngày hôm sau: ngày X "hết hạn" khi qua X+1 mốc + 10 phút.
            ActivityType.Deadline => a.DeadlineTime is TimeOnly t
                && now >= ActivityEvaluator.DeadlineAnchor(today, t, tz).AddMinutes(ActivityEvaluator.DeadlineLateMinutes),
            ActivityType.Window => a.WindowEnd is TimeOnly w
                && now >= ActivityEvaluator.ToInstant(today, w, tz),
            _ => false
        };

        if (!over) return (Pending, null);

        if (dayCheckins.Count > 0 && dayCheckins.All(c => c.Status == CheckInStatus.Rejected))
            return (Fail, "REJECTED");

        if (dayCheckins.Count > 0)
            return (Fail, "LATE");

        return (Fail, "MISSING");
    }

    public static bool IsLate(Activity a, ActivityEvaluation eval, DateOnly today, DateTimeOffset now, TimeZoneInfo tz)
    {
        if (eval.Passed) return false;
        if (a.Type != ActivityType.Deadline || a.DeadlineTime is not TimeOnly t) return false;
        return now >= ActivityEvaluator.DeadlineAnchor(today, t, tz);
    }
}
