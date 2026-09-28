using FluentAssertions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Tests;

public class GroupHandlersTests
{
    // 01:00 UTC = 08:00 giờ VN
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);

    private static async Task<(AppDbContext Db, User Owner, FakeClock Clock)> NewContextAsync()
    {
        var db = DbFactory.New();
        var owner = new User
        {
            GoogleSub = "sub-owner",
            Email = "owner@example.com",
            DisplayName = "Chủ nhóm",
            CreatedAt = Now
        };
        db.Users.Add(owner);
        await db.SaveChangesAsync();
        return (db, owner, new FakeClock(Now));
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

    private static async Task<Group> CreateGroupAsync(AppDbContext db, User owner, FakeClock clock)
    {
        var handler = new CreateGroupHandler(db, new FakeUser(owner.Id), clock);
        var dto = await handler.Handle(new CreateGroupCommand("Team A"), default);
        return await db.Groups.AsNoTracking().SingleAsync(g => g.Id == Guid.Parse(dto.Id));
    }

    [Fact]
    public async Task CreateGroup_AddsOwnerAndGeneratesInviteCode()
    {
        var (db, owner, clock) = await NewContextAsync();
        var handler = new CreateGroupHandler(db, new FakeUser(owner.Id), clock);

        var result = await handler.Handle(new CreateGroupCommand("  Team A  "), default);

        result.Name.Should().Be("Team A");
        result.InviteCode.Should().HaveLength(6).And.MatchRegex("^[A-HJ-NP-Z2-9]{6}$");
        result.OwnerId.Should().Be(owner.Id.ToString());
        result.ReviewWindowHours.Should().Be(12);
        result.PenaltyTiers.Tiers.Should().Equal(0, 20_000, 50_000, 70_000);
        result.PenaltyTiers.ExtraPerActivity.Should().Be(20_000);
        result.Members.Should().HaveCount(1);
        result.Members[0].UserId.Should().Be(owner.Id.ToString());
        result.Members[0].DisplayName.Should().Be("Chủ nhóm");
        result.Members[0].Role.Should().Be("OWNER");
    }

    [Fact]
    public async Task JoinGroup_ValidCode_AddsMemberWithMemberRole()
    {
        var (db, owner, clock) = await NewContextAsync();
        var group = await CreateGroupAsync(db, owner, clock);
        var second = await AddUserAsync(db, "sub-two", "Người thứ hai");

        var handler = new JoinGroupHandler(db, new FakeUser(second.Id), clock);
        var result = await handler.Handle(
            new JoinGroupCommand(group.InviteCode.ToLowerInvariant()), default);

        result.Members.Should().HaveCount(2);
        result.Members.Single(m => m.UserId == second.Id.ToString()).Role.Should().Be("MEMBER");
    }

    [Fact]
    public async Task JoinGroup_UnknownCode_ThrowsBusinessRule()
    {
        var (db, owner, clock) = await NewContextAsync();
        var handler = new JoinGroupHandler(db, new FakeUser(owner.Id), clock);

        var act = () => handler.Handle(new JoinGroupCommand("ZZZZZZ"), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task GetGroup_NonMember_ThrowsUnauthorized()
    {
        var (db, owner, clock) = await NewContextAsync();
        var group = await CreateGroupAsync(db, owner, clock);
        var outsider = await AddUserAsync(db, "sub-out", "Người ngoài");

        var handler = new GetGroupHandler(db, new FakeUser(outsider.Id));

        var act = () => handler.Handle(new GetGroupQuery(group.Id), default);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task UpdatePenaltyTiers_Owner_SavesNewTiers()
    {
        var (db, owner, clock) = await NewContextAsync();
        var group = await CreateGroupAsync(db, owner, clock);
        var handler = new UpdatePenaltyTiersHandler(db, new FakeUser(owner.Id));

        var result = await handler.Handle(
            new UpdatePenaltyTiersCommand(group.Id, new long[] { 0, 10_000, 30_000, 60_000 }, 5_000), default);

        result.PenaltyTiers.Tiers.Should().Equal(0, 10_000, 30_000, 60_000);
        result.PenaltyTiers.ExtraPerActivity.Should().Be(5_000);
    }

    [Fact]
    public async Task UpdatePenaltyTiers_Member_ThrowsUnauthorized()
    {
        var (db, owner, clock) = await NewContextAsync();
        var group = await CreateGroupAsync(db, owner, clock);
        var member = await AddUserAsync(db, "sub-member", "Thành viên");
        db.GroupMembers.Add(new GroupMember
        {
            GroupId = group.Id,
            UserId = member.Id,
            Role = MemberRole.Member,
            JoinedAt = Now
        });
        await db.SaveChangesAsync();

        var handler = new UpdatePenaltyTiersHandler(db, new FakeUser(member.Id));
        var act = () => handler.Handle(
            new UpdatePenaltyTiersCommand(group.Id, new long[] { 0, 10_000 }, 5_000), default);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task UpdatePenaltyTiers_InvalidTiers_ThrowsValidation()
    {
        var (db, owner, clock) = await NewContextAsync();
        var group = await CreateGroupAsync(db, owner, clock);
        var handler = new UpdatePenaltyTiersHandler(db, new FakeUser(owner.Id));

        // Bậc 0 không bằng 0 / không tăng dần
        var act = () => handler.Handle(
            new UpdatePenaltyTiersCommand(group.Id, new long[] { 10_000, 5_000 }, 5_000), default);

        await act.Should().ThrowAsync<Common.ValidationException>();
    }

    [Fact]
    public async Task RemoveMember_Owner_RemovesMember()
    {
        var (db, owner, clock) = await NewContextAsync();
        var group = await CreateGroupAsync(db, owner, clock);
        var member = await AddUserAsync(db, "sub-member", "Thành viên");
        db.GroupMembers.Add(new GroupMember
        {
            GroupId = group.Id,
            UserId = member.Id,
            Role = MemberRole.Member,
            JoinedAt = Now
        });
        await db.SaveChangesAsync();

        var handler = new RemoveMemberHandler(db, new FakeUser(owner.Id));
        var removed = await handler.Handle(new RemoveMemberCommand(group.Id, member.Id), default);

        removed.Should().BeTrue();
        (await db.GroupMembers.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task RemoveMember_OwnerCannotRemoveSelf()
    {
        var (db, owner, clock) = await NewContextAsync();
        var group = await CreateGroupAsync(db, owner, clock);

        var handler = new RemoveMemberHandler(db, new FakeUser(owner.Id));
        var act = () => handler.Handle(new RemoveMemberCommand(group.Id, owner.Id), default);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }
}
