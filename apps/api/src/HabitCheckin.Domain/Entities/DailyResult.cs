using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Entities;

public class DailyResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChallengeId { get; set; }
    public Guid UserId { get; set; }
    public DateOnly LocalDate { get; set; }

    public int TotalCount { get; set; }
    public int PassedCount { get; set; }
    public int FailedCount { get; set; }
    public long PenaltyAmount { get; set; }
    public ResultStatus Status { get; set; } = ResultStatus.Provisional;
    public DateTimeOffset ComputedAt { get; set; }

    public List<ActivityDayResult> Details { get; set; } = new();
    public Challenge? Challenge { get; set; }
}
