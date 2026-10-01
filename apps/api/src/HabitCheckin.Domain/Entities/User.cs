namespace HabitCheckin.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string GoogleSub { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public string? AvatarPublicId { get; set; }
    public string? AvatarUrl { get; set; }

    /// <summary>Tên đăng nhập (lowercase) cho tài khoản password — null với user Google thường.</summary>
    public string? Username { get; set; }
    /// <summary>Hash PBKDF2-SHA256, null với user Google thường.</summary>
    public string? PasswordHash { get; set; }
    public bool IsAdmin { get; set; }
    /// <summary>User bị admin chặn: mọi request có auth đều trả 403, không refresh được token.</summary>
    public bool IsBanned { get; set; }

    public int? ReminderDeadlineAheadMinutes { get; set; }
    public bool ReminderEndOfDay { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
}
