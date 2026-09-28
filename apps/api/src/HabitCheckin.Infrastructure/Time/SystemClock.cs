using HabitCheckin.Application.Abstractions;

namespace HabitCheckin.Infrastructure.Time;

/// <summary>
/// Đồng hồ hệ thống với múi giờ cố định Asia/Ho_Chi_Minh (UTC+7, không DST).
/// Không dùng NodaTime: VNST không có daylight saving nên TimeZoneInfo custom là đủ.
/// </summary>
public sealed class SystemClock : IClock
{
    public TimeZoneInfo LocalTimeZone { get; } =
        TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "VNST", "VNST");

    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;

    public DateOnly TodayLocal => ToLocalDate(UtcNow);

    public DateTimeOffset ToLocalInstant(DateOnly date, TimeOnly time)
    {
        var local = date.ToDateTime(time);
        return new DateTimeOffset(local, LocalTimeZone.GetUtcOffset(local));
    }

    public DateOnly ToLocalDate(DateTimeOffset instant) =>
        DateOnly.FromDateTime(instant.ToOffset(LocalTimeZone.GetUtcOffset(instant)).DateTime);

    public TimeOnly ToLocalTime(DateTimeOffset instant) =>
        TimeOnly.FromDateTime(instant.ToOffset(LocalTimeZone.GetUtcOffset(instant)).DateTime);
}
