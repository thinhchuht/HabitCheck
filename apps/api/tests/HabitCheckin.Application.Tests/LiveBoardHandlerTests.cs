using FluentAssertions;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Tests;

public class LiveBoardHandlerTests
{
    // 01:00 UTC = 08:00 giờ VN
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(Now.DateTime);

    private sealed class FakePresence : IPresenceTracker
    {
        public Guid? ConnectionAdded(Guid groupId, Guid userId, string connectionId) => null;
        public Guid? ConnectionRemoved(string connectionId) => null;
        public ISet<Guid> GetOnlineUsers(Guid groupId) => new HashSet<Guid>();
    }

    private static async Task<User> AddUserAsync(AppDbContext db, string sub, string name)
    {
        var u = new User
        {
            GoogleSub = sub,
            Email = $"{sub}@example.com",
            DisplayName = name,
            CreatedAt = Now
        };
        db.Users.Add(u);
        await db.SaveChangesAsync();
        return u;
    }

    private static async Task<Group> CreateGroupAsync(AppDbContext db, User owner, string name, FakeClock clock)
    {
        var handler = new CreateGroupHandler(db, new FakeUser(owner.Id), clock);
        var dto = await handler.Handle(new CreateGroupCommand(name), default);
        return await db.Groups.AsNoTracking().SingleAsync(g => g.InviteCode == dto.InviteCode);
    }

    private static Challenge AddChallenge(AppDbContext db, Group group, User user, string title)
    {
        var ch = new Challenge
        {
            GroupId = group.Id,
            UserId = user.Id,
            Title = title,
            StartDate = Today,
            EndDate = Today.AddDays(7),
            Status = ChallengeStatus.Active,
            LockedAt = Now,
            CreatedAt = Now
        };
        db.Challenges.Add(ch);
        return ch;
    }

    private static void AddActivity(AppDbContext db, Challenge ch, string name, int order)
    {
        db.Activities.Add(new Activity
        {
            ChallengeId = ch.Id,
            Name = name,
            Type = ActivityType.Deadline,
            DeadlineTime = new TimeOnly(6, 0),
            GraceMinutes = 0,
            ProofType = ProofType.Photo,
            SortOrder = order
        });
    }

    [Fact]
    public async Task GetGroupLive_OnlyShowsChallengesOfRequestedGroup()
    {
        var db = DbFactory.New();
        var owner = await AddUserAsync(db, "sub-owner", "Chủ nhóm");
        var clock = new FakeClock(Now);

        var groupA = await CreateGroupAsync(db, owner, "Nhóm A", clock);
        var groupB = await CreateGroupAsync(db, owner, "Nhóm B", clock);

        // Cùng một user có kỳ ACTIVE phủ hôm nay ở CẢ HAI nhóm
        var chA = AddChallenge(db, groupA, owner, "Kỳ A");
        AddActivity(db, chA, "Hoạt động A", 1);
        var chB = AddChallenge(db, groupB, owner, "Kỳ B");
        AddActivity(db, chB, "Hoạt động B", 1);
        await db.SaveChangesAsync();

        var handler = new LiveBoardHandler(db, new FakeUser(owner.Id), clock, new FakePresence());
        var board = await handler.Handle(new GetGroupLiveQuery(groupA.Id), default);

        var ownerRow = board.Members.Single(m => m.UserId == owner.Id.ToString());
        // Chỉ hiện hoạt động của kỳ trong Nhóm A, không trộn kỳ của Nhóm B
        ownerRow.Items.Should().ContainSingle().Which.Name.Should().Be("Hoạt động A");
        board.Ticker.Should().BeEmpty();
    }
}
