using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Entities;

public class UploadIntent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? ActivityId { get; set; }
    public UploadIntentKind Kind { get; set; }
    public DateTimeOffset IntentAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
}
