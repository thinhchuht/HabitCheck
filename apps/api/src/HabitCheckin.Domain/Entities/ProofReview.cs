using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Entities;

public class ProofReview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CheckinId { get; set; }
    public Guid ReviewerId { get; set; }
    public ProofReviewAction Action { get; set; }
    public string? Reason { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User? Reviewer { get; set; }
    public CheckIn? Checkin { get; set; }
}
