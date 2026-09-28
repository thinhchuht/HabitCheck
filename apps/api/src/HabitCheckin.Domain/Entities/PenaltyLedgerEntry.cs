using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Entities;

public class PenaltyLedgerEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    public Guid? DailyResultId { get; set; }
    public long Amount { get; set; }
    public LedgerKind Kind { get; set; }
    public string? Note { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User? User { get; set; }
    public User? CreatedByUser { get; set; }
    public DailyResult? DailyResult { get; set; }
}
