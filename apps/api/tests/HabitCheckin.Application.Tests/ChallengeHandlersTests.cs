using FluentAssertions;
using HabitCheckin.Application.Challenges;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Tests;

public class ChallengeHandlersTests
{
    // 01:00 UTC = 08:00 giờ VN
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(Now.DateTime);

    private static async Task<(AppDbContext Db, Group Group, User Owner, User Member, User Outsider)> NewContextAsync()
    {
        var db = DbFactory.New();
        var owner = new User
        {
            GoogleSub = "sub-owner",
            Email = "owner@example.com",
            DisplayName = "Chủ nhóm",
            CreatedAt = Now
        };
        var member = new User
        {
            GoogleSub = "sub-member",
            Email = "member@example.com",
            DisplayName = "Thành viên",
            CreatedAt = Now
        };
        var outsider = new User
        {
            GoogleSub = "sub-out",
            Email = "out@example.com",
            DisplayName = "Người ngoài",
            CreatedAt = Now
        };
        db.Users.AddRange(owner, member, outsider);
        await db.SaveChangesAsync();

        var group = await CreateGroupAsync(db, owner);
        db.GroupMembers.Add(new GroupMember
        {
            GroupId = group.Id,
            UserId = member.Id,
            Role = MemberRole.Member,
            JoinedAt = Now
        });
        await db.SaveChangesAsync();
        return (db, group, owner, member, outsider);
    }

    private static async Task<Group> CreateGroupAsync(AppDbContext db, User owner)
    {
        var handler = new CreateGroupHandler(db, new FakeUser(owner.Id), new FakeClock(Now));
        var dto = await handler.Handle(new CreateGroupCommand("Team A"), default);
        return await db.Groups.AsNoTracking().SingleAsync(g => g.InviteCode == dto.InviteCode);
    }

    private static Challenge AddChallenge(AppDbContext db, Group group, User user, string title, ChallengeStatus status)
    {
        var ch = new Challenge
        {
            GroupId = group.Id,
            UserId = user.Id,
            Title = title,
            StartDate = Today,
            EndDate = Today.AddDays(7),
            Status = status,
            LockedAt = status == ChallengeStatus.Active ? Now : null,
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
    public async Task GetGroupChallenges_NonMember_ThrowsUnauthorized()
    {
        var (db, group, _, _, outsider) = await NewContextAsync();

        var handler = new GetGroupChallengesHandler(db, new FakeUser(outsider.Id));
        var act = () => handler.Handle(new GetGroupChallengesQuery(group.Id), default);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task GetGroupChallenges_Member_SeesAllGroupChallengesWithOwnerNames()
    {
        var (db, group, owner, member, _) = await NewContextAsync();

        // Chủ nhóm: kỳ ACTIVE, 2 hoạt động cố ý đảo SortOrder khi nhập
        var ownerActive = AddChallenge(db, group, owner, "Kỳ của chủ", ChallengeStatus.Active);
        AddActivity(db, ownerActive, "Hoạt động B", 2);
        AddActivity(db, ownerActive, "Hoạt động A", 1);
        // Thành viên: kỳ DRAFT, 1 hoạt động
        var memberDraft = AddChallenge(db, group, member, "Kỳ của thành viên", ChallengeStatus.Draft);
        AddActivity(db, memberDraft, "Dậy sớm", 1);
        await db.SaveChangesAsync();

        var handler = new GetGroupChallengesHandler(db, new FakeUser(member.Id));
        var result = await handler.Handle(new GetGroupChallengesQuery(group.Id), default);

        result.Should().HaveCount(2);

        // ACTIVE xếp trước DRAFT
        result[0].Title.Should().Be("Kỳ của chủ");
        result[0].Status.Should().Be(ChallengeStatus.Active);
        result[0].OwnerName.Should().Be("Chủ nhóm");
        result[0].UserId.Should().Be(owner.Id.ToString());
        result[0].Activities.Should().BeInAscendingOrder(a => a.SortOrder);
        result[0].Activities[0].Name.Should().Be("Hoạt động A");

        result[1].Title.Should().Be("Kỳ của thành viên");
        result[1].Status.Should().Be(ChallengeStatus.Draft);
        result[1].OwnerName.Should().Be("Thành viên");
        result[1].UserId.Should().Be(member.Id.ToString());
        result[1].Activities.Should().ContainSingle(a => a.Name == "Dậy sớm");
    }
}
