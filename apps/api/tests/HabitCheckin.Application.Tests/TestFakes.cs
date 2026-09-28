using HabitCheckin.Application.Abstractions;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Tests;

internal sealed class FakeUser(Guid id) : ICurrentUser
{
    public Guid Id { get; } = id;
}

/// <summary>Clock giả: UTC cố định, zone VN UTC+7 (không DST).</summary>
internal sealed class FakeClock(DateTimeOffset utcNow) : IClock
{
    private static readonly TimeSpan VnOffset = TimeSpan.FromHours(7);

    public DateTimeOffset UtcNow { get; } = utcNow;
    public DateOnly TodayLocal => ToLocalDate(UtcNow);
    public TimeZoneInfo LocalTimeZone { get; } =
        TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", VnOffset, "VNST", "VNST");

    public DateTimeOffset ToLocalInstant(DateOnly date, TimeOnly time) =>
        new(date.ToDateTime(time), VnOffset);

    public DateOnly ToLocalDate(DateTimeOffset instant) =>
        DateOnly.FromDateTime(instant.ToOffset(VnOffset).DateTime);
    public TimeOnly ToLocalTime(DateTimeOffset instant) =>
        TimeOnly.FromTimeSpan(instant.ToOffset(VnOffset).TimeOfDay);
}

public static class DbFactory
{
    public static AppDbContext New() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);
}
