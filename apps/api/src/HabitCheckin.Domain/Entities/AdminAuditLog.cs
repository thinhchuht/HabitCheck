namespace HabitCheckin.Domain.Entities;

/// <summary>Ghi nhận thao tác của admin (cấm user, cấp quyền, chạy job, broadcast...).</summary>
public class AdminAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AdminId { get; set; }

    /// <summary>BAN | UNBAN | RENAME | SET_PASSWORD | GRANT_ADMIN | REVOKE_ADMIN | SETTLE | FINALIZE | ACTIVATE | ANNOUNCE</summary>
    public string Action { get; set; } = null!;
    public string? TargetType { get; set; }
    public Guid? TargetId { get; set; }
    public string? Detail { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User? Admin { get; set; }
}
