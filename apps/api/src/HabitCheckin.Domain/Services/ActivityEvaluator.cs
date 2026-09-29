using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Services;

public sealed record ActivityEvaluation(
    Guid ActivityId,
    bool Passed,
    string? Reason,
    int? ActualMinutes,
    DateTimeOffset? FirstCheckinAt);

public static class ActivityEvaluator
{
    /// <summary>Cửa sổ check-in DEADLINE: chỉ nhận trong ±N phút quanh mốc giờ.</summary>
    public const int DeadlineWindowMinutes = 5;

    public static ActivityEvaluation Evaluate(Activity a, DateOnly date, IReadOnlyList<CheckIn> dayCheckins, TimeZoneInfo tz)
    {
        var valid = dayCheckins.Where(c => c.ActivityId == a.Id && c.Status != CheckInStatus.Rejected).ToList();
        var rejectedOnly = valid.Count == 0 && dayCheckins.Any(c => c.ActivityId == a.Id && c.Status == CheckInStatus.Rejected);

        switch (a.Type)
        {
            case ActivityType.Deadline:
                {
                    var first = valid.OrderBy(c => c.CheckinAt).FirstOrDefault();
                    if (first is null)
                        return new ActivityEvaluation(a.Id, false, rejectedOnly ? "REJECTED" : "MISSING", null, null);
                    var limit = ToInstant(date, a.DeadlineTime!.Value.AddMinutes(DeadlineWindowMinutes), tz);
                    return first.CheckinAt <= limit
                        ? new ActivityEvaluation(a.Id, true, null, null, first.CheckinAt)
                        : new ActivityEvaluation(a.Id, false, "LATE", null, first.CheckinAt);
                }

            case ActivityType.Duration:
                {
                    // DURATION là "tick + 1 ảnh": PASS khi có 1 check-in hoàn thành trong ngày, không đo thời lượng.
                    var done = valid
                        .Where(c => c.Status == CheckInStatus.Completed)
                        .OrderBy(c => c.CheckinAt)
                        .FirstOrDefault();
                    if (done is null)
                        return new ActivityEvaluation(a.Id, false, rejectedOnly ? "REJECTED" : "MISSING", null, null);
                    return new ActivityEvaluation(a.Id, true, null, null, done.CheckinAt);
                }

            case ActivityType.Window:
                {
                    var start = ToInstant(date, a.WindowStart!.Value, tz);
                    var end = ToInstant(date, a.WindowEnd!.Value, tz);
                    var hit = valid.FirstOrDefault(c => c.CheckinAt >= start && c.CheckinAt <= end);
                    var first = valid.OrderBy(c => c.CheckinAt).FirstOrDefault();
                    return hit is not null
                        ? new ActivityEvaluation(a.Id, true, null, null, hit.CheckinAt)
                        : new ActivityEvaluation(
                            a.Id,
                            false,
                            valid.Count == 0 ? (rejectedOnly ? "REJECTED" : "MISSING") : "LATE",
                            null,
                            first?.CheckinAt);
                }

            default:
                throw new ArgumentOutOfRangeException(nameof(a), a.Type, "Unknown activity type");
        }
    }

    public static DateTimeOffset ToInstant(DateOnly d, TimeOnly t, TimeZoneInfo tz)
    {
        var local = d.ToDateTime(t);
        return new DateTimeOffset(local, tz.GetUtcOffset(local));
    }
}
