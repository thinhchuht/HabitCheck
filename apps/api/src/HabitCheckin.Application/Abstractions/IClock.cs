namespace HabitCheckin.Application.Abstractions;

public interface IClock
{
    DateTimeOffset UtcNow { get; }

    /// <summary>Ngày hiện tại theo giờ địa phương (Asia/Ho_Chi_Minh).</summary>
    DateOnly TodayLocal { get; }

    TimeZoneInfo LocalTimeZone { get; }

    /// <summary>Chuyển giờ wall-clock địa phương sang instant UTC.</summary>
    DateTimeOffset ToLocalInstant(DateOnly date, TimeOnly time);

    DateOnly ToLocalDate(DateTimeOffset instant);
    TimeOnly ToLocalTime(DateTimeOffset instant);
}
