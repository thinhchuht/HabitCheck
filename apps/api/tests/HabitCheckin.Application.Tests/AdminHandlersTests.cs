using FluentAssertions;
using HabitCheckin.Application.Admin;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Tests;

public class AdminHandlersTests
{
    // 01:00 UTC = 08:00 giờ VN, ngày VN = 2025-01-15
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2025, 1, 15);

    /// <summary>
    /// Ngữ cảnh mẫu: 2 user (owner + member), 1 nhóm, 1 challenge ACTIVE
    /// với 1 hoạt động DEADLINE và 2 ngày kết quả của owner.
    /// </summary>
    private static async Task<(AppDbContext Db, User Owner, User Member, Group Group, Challenge Challenge)>
        NewContextAsync()
    {
        var db = DbFactory.New();
        var owner = new User
        {
            GoogleSub = "g-owner",
            Email = "owner@example.com",
            DisplayName = "Chủ nhóm",
            CreatedAt = Now
        };
        var member = new User
        {
            GoogleSub = "g-member",
            Email = "member@example.com",
            DisplayName = "Thành viên",
            CreatedAt = Now
        };
        db.Users.AddRange(owner, member);
        await db.SaveChangesAsync();

        var create = new CreateGroupHandler(db, new FakeUser(owner.Id), new FakeClock(Now));
        var groupDto = await create.Handle(new CreateGroupCommand("Team A"), default);
        var group = await db.Groups.SingleAsync(g => g.Id == Guid.Parse(groupDto.Id));

        db.GroupMembers.Add(new GroupMember
        {
            GroupId = group.Id,
            UserId = member.Id,
            Role = MemberRole.Member,
            JoinedAt = Now
        });

        var challenge = new Challenge
        {
            GroupId = group.Id,
            UserId = owner.Id,
            Title = "Kỳ tháng 1",
            StartDate = new DateOnly(2025, 1, 8),
            EndDate = new DateOnly(2025, 1, 21),
            Status = ChallengeStatus.Active,
            LockedAt = Now,
            CreatedAt = Now
        };
        db.Challenges.Add(challenge);
        db.Activities.Add(new Activity
        {
            ChallengeId = challenge.Id,
            Name = "Dậy sớm",
            Type = ActivityType.Deadline,
            DeadlineTime = new TimeOnly(6, 0),
            SortOrder = 0
        });

        // Hôm nay: fail 1 hoạt động, phạt 20k. Hôm qua: không fail.
        db.DailyResults.AddRange(
            new DailyResult
            {
                ChallengeId = challenge.Id,
                UserId = owner.Id,
                LocalDate = Today,
                TotalCount = 2,
                PassedCount = 1,
                FailedCount = 1,
                PenaltyAmount = 20_000,
                Status = ResultStatus.Final,
                ComputedAt = Now
            },
            new DailyResult
            {
                ChallengeId = challenge.Id,
                UserId = owner.Id,
                LocalDate = Today.AddDays(-1),
                TotalCount = 2,
                PassedCount = 2,
                FailedCount = 0,
                PenaltyAmount = 0,
                Status = ResultStatus.Final,
                ComputedAt = Now
            });
        await db.SaveChangesAsync();
        return (db, owner, member, group, challenge);
    }

    // ---------- Stats ----------

    [Fact]
    public async Task Stats_CountsUsersGroupsChallengesAndPenalties()
    {
        var (db, owner, member, group, challenge) = await NewContextAsync();
        var handler = new AdminStatsHandler(db, new FakeClock(Now));

        var result = await handler.Handle(new AdminStatsQuery(), default);

        result.TotalUsers.Should().Be(2);
        result.TotalGroups.Should().Be(1);
        result.ActiveChallenges.Should().Be(1);
        result.DraftChallenges.Should().Be(0);
        result.CheckinsToday.Should().Be(0);
        result.PenaltyTodayVnd.Should().Be(20_000);
        result.PenaltyTotalVnd.Should().Be(20_000);
        result.RecentUsers.Should().HaveCount(2);
        result.RecentUsers.Should().OnlyContain(u => u.GroupCount == 1);
        result.RecentUsers.Single(u => u.Id == owner.Id.ToString()).DisplayName.Should().Be("Chủ nhóm");
    }

    // ---------- Users ----------

    [Fact]
    public async Task Users_WithoutSearch_ReturnsAllOrderedByCreatedAtDesc()
    {
        var (db, _, _, _, _) = await NewContextAsync();
        var handler = new AdminUsersHandler(db);

        var result = await handler.Handle(new AdminUsersQuery(null, 1, 20), default);

        result.Total.Should().Be(2);
        result.Users.Should().HaveCount(2);
    }

    [Fact]
    public async Task Users_WithSearch_FiltersByNameAndEmail()
    {
        var (db, _, _, _, _) = await NewContextAsync();
        var handler = new AdminUsersHandler(db);

        var byName = await handler.Handle(
            new AdminUsersQuery("thành viên", 1, 20), default);
        byName.Total.Should().Be(1);
        byName.Users[0].DisplayName.Should().Be("Thành viên");

        var byEmail = await handler.Handle(
            new AdminUsersQuery("owner@", 1, 20), default);
        byEmail.Total.Should().Be(1);
        byEmail.Users[0].Email.Should().Be("owner@example.com");

        var byNone = await handler.Handle(new AdminUsersQuery("không-có", 1, 20), default);
        byNone.Total.Should().Be(0);
    }

    [Fact]
    public async Task Users_PaginateAndAggregatePenalties()
    {
        var (db, owner, _, _, _) = await NewContextAsync();
        var handler = new AdminUsersHandler(db);

        var page1 = await handler.Handle(new AdminUsersQuery(null, 1, 1), default);
        page1.Total.Should().Be(2);
        page1.Users.Should().HaveCount(1);

        var page2 = await handler.Handle(new AdminUsersQuery(null, 2, 1), default);
        page2.Users.Should().HaveCount(1);

        var ownerRow = (await handler.Handle(new AdminUsersQuery("owner@", 1, 20), default))
            .Users.Single();
        ownerRow.Id.Should().Be(owner.Id.ToString());
        ownerRow.GroupCount.Should().Be(1);
        ownerRow.SettledDays.Should().Be(2);
        ownerRow.FailedDays.Should().Be(1);
        ownerRow.TotalPenaltyVnd.Should().Be(20_000);
    }

    // ---------- User detail ----------

    [Fact]
    public async Task UserDetail_ReturnsGroupsRolesAndChallengeStats()
    {
        var (db, owner, member, group, challenge) = await NewContextAsync();
        var handler = new AdminUserDetailHandler(db);

        var result = await handler.Handle(new AdminUserDetailQuery(owner.Id), default);

        result.User.Id.Should().Be(owner.Id.ToString());
        result.User.SettledDays.Should().Be(2);
        result.User.FailedDays.Should().Be(1);
        result.User.TotalPenaltyVnd.Should().Be(20_000);
        result.Groups.Should().HaveCount(1);

        var g = result.Groups[0];
        g.GroupId.Should().Be(group.Id.ToString());
        g.GroupName.Should().Be("Team A");
        g.Role.Should().Be("OWNER");
        g.OwnerName.Should().Be("Chủ nhóm");
        g.Challenges.Should().HaveCount(1);

        var c = g.Challenges[0];
        c.Challenge.Id.Should().Be(challenge.Id.ToString());
        c.Challenge.Title.Should().Be("Kỳ tháng 1");
        c.Challenge.Status.Should().Be(ChallengeStatus.Active);
        c.Challenge.Activities.Should().ContainSingle(a => a.Name == "Dậy sớm");
        c.SettledDays.Should().Be(2);
        c.FailedDays.Should().Be(1);
        c.TotalPenaltyVnd.Should().Be(20_000);

        // Member không có challenge nào.
        var memberDetail = await handler.Handle(new AdminUserDetailQuery(member.Id), default);
        memberDetail.Groups.Should().HaveCount(1);
        memberDetail.Groups[0].Role.Should().Be("MEMBER");
        memberDetail.Groups[0].Challenges.Should().BeEmpty();
    }

    [Fact]
    public async Task UserDetail_UnknownUser_ThrowsNotFound()
    {
        var (db, _, _, _, _) = await NewContextAsync();
        var handler = new AdminUserDetailHandler(db);

        var act = () => handler.Handle(new AdminUserDetailQuery(Guid.NewGuid()), default);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    // ---------- Groups ----------

    [Fact]
    public async Task Groups_ReturnsAllWithCounts()
    {
        var (db, _, _, group, _) = await NewContextAsync();
        var handler = new AdminGroupsHandler(db);

        var result = await handler.Handle(new AdminGroupsQuery(), default);

        result.Total.Should().Be(1);
        result.Groups[0].Id.Should().Be(group.Id.ToString());
        result.Groups[0].Name.Should().Be("Team A");
        result.Groups[0].OwnerName.Should().Be("Chủ nhóm");
        result.Groups[0].MemberCount.Should().Be(2);
        result.Groups[0].ChallengeCount.Should().Be(1);
    }

    [Fact]
    public async Task GroupDetail_ReturnsMembersAndChallenges()
    {
        var (db, owner, member, group, challenge) = await NewContextAsync();
        var handler = new AdminGroupDetailHandler(db);

        var result = await handler.Handle(new AdminGroupDetailQuery(group.Id), default);

        result.Group.Id.Should().Be(group.Id.ToString());
        result.Group.Members.Should().HaveCount(2);
        result.Group.Members.Should().Contain(m => m.Role == "OWNER" && m.UserId == owner.Id.ToString());
        result.Group.Members.Should().Contain(m => m.Role == "MEMBER" && m.UserId == member.Id.ToString());
        result.Challenges.Should().ContainSingle(c => c.Challenge.Id == challenge.Id.ToString());
    }

    [Fact]
    public async Task GroupDetail_UnknownGroup_ThrowsNotFound()
    {
        var (db, _, _, _, _) = await NewContextAsync();
        var handler = new AdminGroupDetailHandler(db);

        var act = () => handler.Handle(new AdminGroupDetailQuery(Guid.NewGuid()), default);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    // ---------- Cấp / thu hồi quyền admin ----------

    [Fact]
    public async Task SetUserAdmin_GrantsAndRevokes()
    {
        var (db, owner, member, _, _) = await NewContextAsync();
        var handler = new SetUserAdminHandler(db, new FakeUser(owner.Id));

        var granted = await handler.Handle(new SetUserAdminCommand(member.Id, true), default);
        granted.IsAdmin.Should().BeTrue();
        (await db.Users.SingleAsync(u => u.Id == member.Id)).IsAdmin.Should().BeTrue();

        var revoked = await handler.Handle(new SetUserAdminCommand(member.Id, false), default);
        revoked.IsAdmin.Should().BeFalse();
    }

    [Fact]
    public async Task SetUserAdmin_SelfRevoke_ThrowsBusinessRule()
    {
        var (db, _, member, _, _) = await NewContextAsync();
        var handler = new SetUserAdminHandler(db, new FakeUser(member.Id));

        var act = () => handler.Handle(new SetUserAdminCommand(member.Id, false), default);
        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task SetUserAdmin_UnknownUser_ThrowsNotFound()
    {
        var (db, owner, _, _, _) = await NewContextAsync();
        var handler = new SetUserAdminHandler(db, new FakeUser(owner.Id));

        var act = () => handler.Handle(new SetUserAdminCommand(Guid.NewGuid(), true), default);
        await act.Should().ThrowAsync<NotFoundException>();
    }
}
