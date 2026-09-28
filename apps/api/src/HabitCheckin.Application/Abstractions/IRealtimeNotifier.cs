namespace HabitCheckin.Application.Abstractions;

public static class EventNames
{
    public const string CheckInCreated = "CheckInCreated";
    public const string CheckOutCompleted = "CheckOutCompleted";
    public const string SessionStarted = "SessionStarted";
    public const string ProofRejected = "ProofRejected";
    public const string DailyResultUpdated = "DailyResultUpdated";
    public const string MemberPresence = "MemberPresence";
    public const string ProfileUpdated = "ProfileUpdated";
    public const string Reminder = "Reminder";
}

public sealed record CheckInCreatedEvent(string UserId, string ActivityId, string ActivityName, DateTimeOffset CheckinAt, bool IsLate, string? ThumbnailUrl);
public sealed record CheckOutCompletedEvent(string UserId, string ActivityId, int DurationMinutes, int TotalTodayMinutes);
public sealed record SessionStartedEvent(string UserId, string ActivityId, DateTimeOffset StartedAt);
public sealed record ProofRejectedEvent(string CheckinId, string UserId, string Reason);
public sealed record DailyResultUpdatedEvent(string UserId, string Date, int FailedCount, long PenaltyAmount, string Status);
public sealed record MemberPresenceEvent(string UserId, bool Online);
public sealed record ProfileUpdatedEvent(string UserId, string DisplayName, string? AvatarUrl);
public sealed record ReminderEvent(string UserId, string? ActivityId, string Message);

public interface IRealtimeNotifier
{
    /// <summary>Đẩy event cho tất cả connection đang join nhóm groupId.</summary>
    Task GroupAsync(Guid groupId, string eventName, object payload, CancellationToken ct = default);

    /// <summary>Đẩy event cho connection của chính user (nhóm riêng user:{id}).</summary>
    Task UserAsync(Guid userId, string eventName, object payload, CancellationToken ct = default);
}
