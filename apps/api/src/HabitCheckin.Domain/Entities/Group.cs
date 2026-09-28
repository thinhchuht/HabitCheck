using HabitCheckin.Domain.ValueObjects;

namespace HabitCheckin.Domain.Entities;

public class Group
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = null!;
    public string InviteCode { get; set; } = null!;
    public Guid OwnerId { get; set; }
    public PenaltyTiers PenaltyTiers { get; set; } = PenaltyTiers.Default;
    public int ReviewWindowHours { get; set; } = 12;
    public DateTimeOffset CreatedAt { get; set; }
}
