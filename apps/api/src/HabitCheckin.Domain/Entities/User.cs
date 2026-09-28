namespace HabitCheckin.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string GoogleSub { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public string? AvatarPublicId { get; set; }
    public string? AvatarUrl { get; set; }

    public int? ReminderDeadlineAheadMinutes { get; set; }
    public bool ReminderEndOfDay { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
}
