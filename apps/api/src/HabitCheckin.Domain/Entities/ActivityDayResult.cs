namespace HabitCheckin.Domain.Entities;

public class ActivityDayResult
{
    public Guid DailyResultId { get; set; }
    public Guid ActivityId { get; set; }
    public bool Passed { get; set; }
    public string? Reason { get; set; }
    public int? ActualMinutes { get; set; }
    public DateTimeOffset? FirstCheckinAt { get; set; }
}
