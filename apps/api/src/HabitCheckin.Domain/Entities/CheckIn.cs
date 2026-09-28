using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Entities;

public class CheckIn
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActivityId { get; set; }
    public Guid UserId { get; set; }
    public DateOnly LocalDate { get; set; }

    public DateTimeOffset CheckinAt { get; set; }
    public DateTimeOffset? CheckoutAt { get; set; }
    public int? DurationMinutes { get; set; }

    public Guid CheckinMediaId { get; set; }
    public Guid? CheckoutMediaId { get; set; }

    public string? Note { get; set; }
    public CheckInStatus Status { get; set; } = CheckInStatus.Open;
    public DateTimeOffset CreatedAt { get; set; }

    public MediaAsset? CheckinMedia { get; set; }
    public MediaAsset? CheckoutMedia { get; set; }
    public Activity? Activity { get; set; }
    public User? User { get; set; }
}
