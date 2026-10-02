using FluentAssertions;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Domain.Services;

namespace HabitCheckin.Domain.Tests;

public class ActivityEvaluatorTests
{
    private static readonly TimeZoneInfo Tz =
        TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "VNST", "VNST");

    private static readonly DateOnly Date = new(2025, 1, 15);
    private static readonly Guid ActivityId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    private static DateTimeOffset Local(int hour, int minute) =>
        new(new DateTime(2025, 1, 15, hour, minute, 0), TimeSpan.FromHours(7));

    private static Activity NewActivity(ActivityType type, TimeOnly? deadline = null,
        int? target = null, int? minSession = null, TimeOnly? winStart = null, TimeOnly? winEnd = null) => new()
        {
            Id = ActivityId,
            ChallengeId = Guid.NewGuid(),
            Name = "Hoạt động thử",
            Type = type,
            DeadlineTime = deadline,
            GraceMinutes = 0,
            TargetMinutes = target,
            MinSessionMinutes = minSession,
            WindowStart = winStart,
            WindowEnd = winEnd
        };

    private static CheckIn NewCheckin(DateTimeOffset at, CheckInStatus status, int? minutes = null) => new()
    {
        Id = Guid.NewGuid(),
        ActivityId = ActivityId,
        UserId = UserId,
        LocalDate = Date,
        CheckinAt = at,
        Status = status,
        DurationMinutes = minutes,
        CreatedAt = at
    };

    // ---------- DEADLINE ----------

    [Fact]
    public void Deadline_BeforeDeadline_Passes()
    {
        var a = NewActivity(ActivityType.Deadline, deadline: new TimeOnly(6, 0));
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(5, 48), CheckInStatus.Completed)], Tz);

        result.Passed.Should().BeTrue();
        result.Reason.Should().BeNull();
        result.FirstCheckinAt.Should().Be(Local(5, 48));
    }

    [Fact]
    public void Deadline_AfterDeadlineButInsideWindow_Passes()
    {
        // Check-in sau mốc 6:00 nhưng còn trong cửa sổ +10 phút (6:08) → PASS.
        var a = NewActivity(ActivityType.Deadline, deadline: new TimeOnly(6, 0));
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(6, 8), CheckInStatus.Completed)], Tz);

        result.Passed.Should().BeTrue();
    }

    [Fact]
    public void Deadline_AfterWindow_IsLate()
    {
        // 6:11 > mốc 6:00 + 10 phút → LATE.
        var a = NewActivity(ActivityType.Deadline, deadline: new TimeOnly(6, 0));
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(6, 11), CheckInStatus.Completed)], Tz);

        result.Passed.Should().BeFalse();
        result.Reason.Should().Be("LATE");
    }

    [Fact]
    public void Deadline_NoCheckin_IsMissing()
    {
        var a = NewActivity(ActivityType.Deadline, deadline: new TimeOnly(6, 0));
        var result = ActivityEvaluator.Evaluate(a, Date, [], Tz);

        result.Passed.Should().BeFalse();
        result.Reason.Should().Be("MISSING");
    }

    [Fact]
    public void Deadline_OnlyRejectedCheckin_IsRejected()
    {
        var a = NewActivity(ActivityType.Deadline, deadline: new TimeOnly(6, 0));
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(5, 30), CheckInStatus.Rejected)], Tz);

        result.Passed.Should().BeFalse();
        result.Reason.Should().Be("REJECTED");
    }

    // ---------- DURATION (tick + 1 ảnh: 1 check-in hoàn thành trong ngày là PASS) ----------

    [Fact]
    public void Duration_CompletedCheckin_Passes()
    {
        var a = NewActivity(ActivityType.Duration, target: 60);
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(8, 0), CheckInStatus.Completed)], Tz);

        result.Passed.Should().BeTrue();
        result.Reason.Should().BeNull();
        result.FirstCheckinAt.Should().Be(Local(8, 0));
    }

    [Fact]
    public void Duration_NoCheckin_IsMissing()
    {
        var a = NewActivity(ActivityType.Duration, target: 60);
        var result = ActivityEvaluator.Evaluate(a, Date, [], Tz);

        result.Passed.Should().BeFalse();
        result.Reason.Should().Be("MISSING");
    }

    [Fact]
    public void Duration_OnlyRejectedCheckin_IsRejected()
    {
        var a = NewActivity(ActivityType.Duration, target: 60);
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(8, 0), CheckInStatus.Rejected)], Tz);

        result.Passed.Should().BeFalse();
        result.Reason.Should().Be("REJECTED");
    }

    [Fact]
    public void Duration_LegacyOpenSession_DoesNotPass()
    {
        var a = NewActivity(ActivityType.Duration, target: 60);
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(8, 0), CheckInStatus.Open, 30)], Tz);

        result.Passed.Should().BeFalse();
        result.Reason.Should().Be("MISSING");
    }

    // ---------- WINDOW ----------

    [Fact]
    public void Window_CheckinInsideWindow_Passes()
    {
        var a = NewActivity(ActivityType.Window, winStart: new TimeOnly(12, 0), winEnd: new TimeOnly(13, 0));
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(12, 30), CheckInStatus.Completed)], Tz);

        result.Passed.Should().BeTrue();
        result.Reason.Should().BeNull();
    }

    [Fact]
    public void Window_CheckinAfterWindow_IsLate()
    {
        var a = NewActivity(ActivityType.Window, winStart: new TimeOnly(12, 0), winEnd: new TimeOnly(13, 0));
        var result = ActivityEvaluator.Evaluate(a, Date,
            [NewCheckin(Local(13, 30), CheckInStatus.Completed)], Tz);

        result.Passed.Should().BeFalse();
        result.Reason.Should().Be("LATE");
    }

    [Fact]
    public void Window_NoCheckin_IsMissing()
    {
        var a = NewActivity(ActivityType.Window, winStart: new TimeOnly(12, 0), winEnd: new TimeOnly(13, 0));
        var result = ActivityEvaluator.Evaluate(a, Date, [], Tz);

        result.Passed.Should().BeFalse();
        result.Reason.Should().Be("MISSING");
    }
}
