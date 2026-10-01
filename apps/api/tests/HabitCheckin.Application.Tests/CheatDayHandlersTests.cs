using FluentAssertions;
using HabitCheckin.Application.CheatDays;
using HabitCheckin.Application.CheckIns;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Tests;

public class CheatDayHandlersTests
{
    // 2025-01-15 (thứ Tư), tuần ISO: T2 13/01 → CN 19/01, thứ Hai kế tiếp 20/01
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(Now.DateTime);

    private static async Task<(AppDbContext Db, Group Group, User User, User Outsider)> NewContextAsync()
    {
        var db = DbFactory.New();
        var user = new User
        {
            GoogleSub = "sub-owner",
            Email = "owner@example.com",
            DisplayName = "Chủ nhóm",
            CreatedAt = Now
        };
        var outsider = new User
        {
            GoogleSub = "sub-out",
            Email = "out@example.com",
            DisplayName = "Người ngoài",
            CreatedAt = Now
        };
        db.Users.AddRange(user, outsider);
        await db.SaveChangesAsync();

        var groupHandler = new CreateGroupHandler(db, new FakeUser(user.Id), new FakeClock(Now));
        var dto = await groupHandler.Handle(new CreateGroupCommand("Team A"), default);
        var group = await db.Groups.AsNoTracking().SingleAsync(g => g.InviteCode == dto.InviteCode);
        return (db, group, user, outsider);
    }

    private static MarkCheatDayHandler MarkHandler(AppDbContext db, Guid userId) =>
        new(db, new FakeUser(userId), new FakeClock(Now));

    private static UnmarkCheatDayHandler UnmarkHandler(AppDbContext db, Guid userId) =>
        new(db, new FakeUser(userId), new FakeClock(Now));

    [Fact]
    public async Task MarkCheatDay_NonMember_ThrowsUnauthorized()
    {
        var (db, group, _, outsider) = await NewContextAsync();

        var handler = MarkHandler(db, outsider.Id);
        var act = () => handler.Handle(new MarkCheatDayCommand(group.Id, null), default);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task MarkCheatDay_WithoutDate_MarksToday()
    {
        var (db, group, user, _) = await NewContextAsync();

        var dto = await MarkHandler(db, user.Id).Handle(new MarkCheatDayCommand(group.Id, null), default);

        dto.LocalDate.Should().Be("2025-01-15");
        dto.GroupId.Should().Be(group.Id.ToString());
        (await db.CheatDays.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task MarkCheatDay_PastDate_ThrowsBusinessRule()
    {
        var (db, group, user, _) = await NewContextAsync();

        var act = () => MarkHandler(db, user.Id).Handle(new MarkCheatDayCommand(group.Id, "2025-01-10"), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task MarkCheatDay_Beyond7Days_ThrowsBusinessRule()
    {
        var (db, group, user, _) = await NewContextAsync();

        // 23/01 = hôm nay + 8 ngày
        var act = () => MarkHandler(db, user.Id).Handle(new MarkCheatDayCommand(group.Id, "2025-01-23"), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task MarkCheatDay_SecondDaySameWeek_ThrowsBusinessRule()
    {
        var (db, group, user, _) = await NewContextAsync();
        var handler = MarkHandler(db, user.Id);
        await handler.Handle(new MarkCheatDayCommand(group.Id, null), default); // T4 15/01

        // Thứ Bảy 18/01 vẫn thuộc tuần T2 13/01 → CN 19/01
        var act = () => handler.Handle(new MarkCheatDayCommand(group.Id, "2025-01-18"), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task MarkCheatDay_DifferentWeek_IsAllowed()
    {
        var (db, group, user, _) = await NewContextAsync();
        var handler = MarkHandler(db, user.Id);
        await handler.Handle(new MarkCheatDayCommand(group.Id, null), default); // tuần 13–19/01

        // Thứ Hai 20/01 — tuần kế tiếp, trong vòng 7 ngày tới
        var dto = await handler.Handle(new MarkCheatDayCommand(group.Id, "2025-01-20"), default);

        dto.LocalDate.Should().Be("2025-01-20");
        (await db.CheatDays.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task MarkCheatDay_DuplicateSameDate_ThrowsBusinessRule()
    {
        var (db, group, user, _) = await NewContextAsync();
        var handler = MarkHandler(db, user.Id);
        await handler.Handle(new MarkCheatDayCommand(group.Id, "2025-01-16"), default);

        var act = () => handler.Handle(new MarkCheatDayCommand(group.Id, "2025-01-16"), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task UnmarkCheatDay_Today_RemovesTheDay()
    {
        var (db, group, user, _) = await NewContextAsync();
        var handler = MarkHandler(db, user.Id);
        await handler.Handle(new MarkCheatDayCommand(group.Id, null), default);

        await UnmarkHandler(db, user.Id).Handle(new UnmarkCheatDayCommand(group.Id, "2025-01-15"), default);

        (await db.CheatDays.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task UnmarkCheatDay_NonToday_ThrowsBusinessRule()
    {
        var (db, group, user, _) = await NewContextAsync();
        var handler = MarkHandler(db, user.Id);
        await handler.Handle(new MarkCheatDayCommand(group.Id, "2025-01-16"), default); // ngày mai

        var act = () => UnmarkHandler(db, user.Id).Handle(new UnmarkCheatDayCommand(group.Id, "2025-01-16"), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
        (await db.CheatDays.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task UnmarkCheatDay_NotMarked_ThrowsBusinessRule()
    {
        var (db, group, user, _) = await NewContextAsync();

        var act = () => UnmarkHandler(db, user.Id).Handle(new UnmarkCheatDayCommand(group.Id, "2025-01-15"), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task GetToday_OnCheatDay_ReturnsNeutralItemsAndZeroPenalty()
    {
        var (db, group, user, _) = await NewContextAsync();
        await MarkHandler(db, user.Id).Handle(new MarkCheatDayCommand(group.Id, null), default);

        var ch = new Challenge
        {
            GroupId = group.Id,
            UserId = user.Id,
            Title = "Kỳ test",
            StartDate = Today,
            EndDate = Today.AddDays(7),
            Status = ChallengeStatus.Active,
            LockedAt = Now,
            CreatedAt = Now
        };
        db.Challenges.Add(ch);
        db.Activities.Add(new Activity
        {
            ChallengeId = ch.Id,
            Name = "Dậy sớm",
            Type = ActivityType.Deadline,
            DeadlineTime = new TimeOnly(6, 0),
            GraceMinutes = 0,
            ProofType = ProofType.Photo,
            SortOrder = 1
        });
        await db.SaveChangesAsync();

        var dto = await new GetTodayHandler(db, new FakeUser(user.Id), new FakeClock(Now))
            .Handle(new GetTodayQuery(group.Id), default);

        // Nếu không phải cheat day thì hoạt động trên đã fail (quá hạn 06:00) → phạt > 0
        dto.CheatDay.Should().Be("2025-01-15");
        dto.CheatDaysThisWeek.Should().ContainSingle().Which.Should().Be("2025-01-15");
        dto.ExpectedPenalty.Should().Be(0);
        dto.Items.Should().ContainSingle();
        dto.Items[0].State.Should().Be("PENDING");
        dto.Items[0].FailReason.Should().BeNull();
        dto.Items[0].IsLate.Should().BeFalse();
    }
}
