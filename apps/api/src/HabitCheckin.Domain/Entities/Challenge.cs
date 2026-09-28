using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Entities;

public class Challenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = null!;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public ChallengeStatus Status { get; set; } = ChallengeStatus.Draft;
    public DateTimeOffset? LockedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User? User { get; set; }
    public List<Activity> Activities { get; set; } = new();
}
