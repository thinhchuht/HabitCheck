using FluentAssertions;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Admin;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Tests;

public class AdminManagementHandlersTests
{
    // 01:00 UTC = 08:00 giờ VN, ngày VN = 2025-01-15
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2025, 1, 15);

    private sealed class FakeNotifier : IRealtimeNotifier
    {
        public List<(string Event, object Payload)> Broadcasts { get; } = new();

        public Task GroupAsync(Guid groupId, string eventName, object payload, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task UserAsync(Guid userId, string eventName, object payload, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task BroadcastAsync(string eventName, object payload, CancellationToken ct = default)
        {
            Broadcasts.Add((eventName, payload));
            return Task.CompletedTask;
        }
    }

    /// <summary>
    /// Ngữ cảnh mẫu: 3 user (owner admin Google, member Google, tài khoản password),
    /// 1 nhóm, 1 challenge ACTIVE có 2 hoạt động, 2 ngày kết quả, 1 check-in hôm nay,
    /// 2 mục sổ quỹ (PENALTY + PAYMENT).
    /// </summary>
    private static async Task<(
        AppDbContext Db, User Owner, User Member, User PasswordUser,
        Group Group, Challenge Challenge, Activity Deadline, Activity Duration)>
        NewContextAsync()
    {
        var db = DbFactory.New();
        var owner = new User
        {
            GoogleSub = "g-owner",
            Email = "owner@example.com",
            DisplayName = "Admin Owner",
            IsAdmin = true,
            CreatedAt = Now
        };
        var member = new User
        {
            GoogleSub = "g-member",
            Email = "member@example.com",
            DisplayName = "Thành viên",
            CreatedAt = Now
        };
        var passwordUser = new User
        {
            GoogleSub = "g-password",
            Email = "password@example.com",
            DisplayName = "User mật khẩu",
            Username = "passacc",
            PasswordHash = Pbkdf2PasswordHasher.Hash("oldpass123"),
            CreatedAt = Now
        };
        db.Users.AddRange(owner, member, passwordUser);
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
        var deadline = new Activity
        {
            ChallengeId = challenge.Id,
            Name = "Dậy sớm",
            Type = ActivityType.Deadline,
            DeadlineTime = new TimeOnly(6, 0),
            SortOrder = 0
        };
        var duration = new Activity
        {
            ChallengeId = challenge.Id,
            Name = "Học",
            Type = ActivityType.Duration,
            TargetMinutes = 60,
            SortOrder = 1
        };
        db.Activities.AddRange(deadline, duration);

        // Check-in hôm nay của owner cho hoạt động DEADLINE (cần media FK).
        var media = new MediaAsset
        {
            UserId = owner.Id,
            PublicId = "proof/1",
            ResourceType = "image",
            SecureUrl = "https://res.cloudinary.com/x/image/proof/1.jpg",
            UploadedAt = Now
        };
        db.MediaAssets.Add(media);
        await db.SaveChangesAsync();
        db.CheckIns.Add(new CheckIn
        {
            ActivityId = deadline.Id,
            UserId = owner.Id,
            LocalDate = Today,
            CheckinAt = Now.AddMinutes(-5),
            CheckinMediaId = media.Id,
            Status = CheckInStatus.Completed,
            CreatedAt = Now
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

        db.PenaltyLedger.AddRange(
            new PenaltyLedgerEntry
            {
                GroupId = group.Id,
                UserId = owner.Id,
                Amount = 20_000,
                Kind = LedgerKind.Penalty,
                CreatedBy = owner.Id,
                CreatedAt = Now
            },
            new PenaltyLedgerEntry
            {
                GroupId = group.Id,
                UserId = owner.Id,
                Amount = 10_000,
                Kind = LedgerKind.Payment,
                Note = "Đóng tiền mặt",
                CreatedBy = owner.Id,
                CreatedAt = Now.AddHours(-1)
            });
        await db.SaveChangesAsync();
        return (db, owner, member, passwordUser, group, challenge, deadline, duration);
    }

    // ---------- Cấm / bỏ cấm ----------

    [Fact]
    public async Task BanUser_SetsFlagAndWritesAudit()
    {
        var (db, owner, member, _, _, _, _, _) = await NewContextAsync();
        var handler = new BanUserHandler(db, new FakeUser(owner.Id), new FakeClock(Now));

        var dto = await handler.Handle(new BanUserCommand(member.Id, true), default);

        dto.Id.Should().Be(member.Id.ToString());
        (await db.Users.SingleAsync(u => u.Id == member.Id)).IsBanned.Should().BeTrue();

        var log = await db.AdminAuditLogs.SingleAsync(l => l.Action == "BAN");
        log.AdminId.Should().Be(owner.Id);
        log.TargetId.Should().Be(member.Id);
        log.Detail.Should().Contain("cấm");
    }

    [Fact]
    public async Task BanUser_SelfBan_ThrowsBusinessRule()
    {
        var (db, owner, _, _, _, _, _, _) = await NewContextAsync();
        var handler = new BanUserHandler(db, new FakeUser(owner.Id), new FakeClock(Now));

        var act = () => handler.Handle(new BanUserCommand(owner.Id, true), default);
        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task BanUser_Unban_ClearsFlagAndWritesAudit()
    {
        var (db, owner, member, _, _, _, _, _) = await NewContextAsync();
        var handler = new BanUserHandler(db, new FakeUser(owner.Id), new FakeClock(Now));
        member.IsBanned = true;
        await db.SaveChangesAsync();

        await handler.Handle(new BanUserCommand(member.Id, false), default);

        (await db.Users.SingleAsync(u => u.Id == member.Id)).IsBanned.Should().BeFalse();
        var log = await db.AdminAuditLogs.SingleAsync(l => l.Action == "UNBAN");
        log.Detail.Should().Contain("bỏ cấm");
    }

    // ---------- Đổi tên ----------

    [Fact]
    public async Task RenameUser_TrimsAndWritesAudit()
    {
        var (db, owner, member, _, _, _, _, _) = await NewContextAsync();
        var handler = new RenameUserHandler(db, new FakeUser(owner.Id), new FakeClock(Now));

        var dto = await handler.Handle(new RenameUserCommand(member.Id, "  Thành Viên Mới  "), default);

        dto.DisplayName.Should().Be("Thành Viên Mới");
        (await db.Users.SingleAsync(u => u.Id == member.Id)).DisplayName.Should().Be("Thành Viên Mới");

        var log = await db.AdminAuditLogs.SingleAsync(l => l.Action == "RENAME");
        log.Detail.Should().Be("Đổi tên user: Thành viên → Thành Viên Mới");
    }

    [Fact]
    public async Task RenameUser_UnknownUser_ThrowsNotFound()
    {
        var (db, owner, _, _, _, _, _, _) = await NewContextAsync();
        var handler = new RenameUserHandler(db, new FakeUser(owner.Id), new FakeClock(Now));

        var act = () => handler.Handle(new RenameUserCommand(Guid.NewGuid(), "X"), default);
        await act.Should().ThrowAsync<NotFoundException>();
    }

    // ---------- Đặt lại mật khẩu ----------

    [Fact]
    public async Task SetUserPassword_HashesNewPasswordAndKeepsSecretOutOfAudit()
    {
        var (db, owner, _, passwordUser, _, _, _, _) = await NewContextAsync();
        var handler = new SetUserPasswordHandler(db, new FakeUser(owner.Id), new FakeClock(Now));

        await handler.Handle(new SetUserPasswordCommand(passwordUser.Id, "newpass123"), default);

        var stored = (await db.Users.SingleAsync(u => u.Id == passwordUser.Id)).PasswordHash!;
        Pbkdf2PasswordHasher.Verify("newpass123", stored).Should().BeTrue();
        Pbkdf2PasswordHasher.Verify("oldpass123", stored).Should().BeFalse();

        var log = await db.AdminAuditLogs.SingleAsync(l => l.Action == "SET_PASSWORD");
        log.Detail.Should().Be("Đổi mật khẩu tài khoản @passacc");
        log.Detail.Should().NotContain("newpass123");
    }

    [Fact]
    public async Task SetUserPassword_GoogleUser_ThrowsBusinessRule()
    {
        var (db, owner, member, _, _, _, _, _) = await NewContextAsync();
        var handler = new SetUserPasswordHandler(db, new FakeUser(owner.Id), new FakeClock(Now));

        var act = () => handler.Handle(new SetUserPasswordCommand(member.Id, "newpass123"), default);
        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    // ---------- Audit log ----------

    [Fact]
    public async Task LogAdminAudit_PersistsEntry()
    {
        var (db, owner, _, _, _, _, _, _) = await NewContextAsync();
        var handler = new LogAdminAuditHandler(db, new FakeClock(Now));

        await handler.Handle(
            new LogAdminAuditCommand(owner.Id, "ACTIVATE", null, null, "Kích hoạt kỳ mới"),
            default);

        var log = await db.AdminAuditLogs.SingleAsync(l => l.Action == "ACTIVATE");
        log.AdminId.Should().Be(owner.Id);
        log.Detail.Should().Be("Kích hoạt kỳ mới");
    }

    [Fact]
    public async Task AuditLogs_OrdersDescAndPages()
    {
        var (db, owner, _, _, _, _, _, _) = await NewContextAsync();
        var handler = new AuditLogsHandler(db);
        db.AdminAuditLogs.AddRange(
            new AdminAuditLog { AdminId = owner.Id, Action = "BAN", CreatedAt = Now.AddHours(-3) },
            new AdminAuditLog { AdminId = owner.Id, Action = "RENAME", CreatedAt = Now.AddHours(-2) },
            new AdminAuditLog { AdminId = owner.Id, Action = "ANNOUNCE", CreatedAt = Now.AddHours(-1) });
        await db.SaveChangesAsync();

        var page1 = await handler.Handle(new AuditLogsQuery(1, 2), default);
        page1.Total.Should().Be(3);
        page1.Logs.Should().HaveCount(2);
        page1.Logs[0].Action.Should().Be("ANNOUNCE"); // mới nhất trước
        page1.Logs[1].Action.Should().Be("RENAME");
        page1.Logs[0].AdminName.Should().Be("Admin Owner");

        var page2 = await handler.Handle(new AuditLogsQuery(2, 2), default);
        page2.Logs.Should().ContainSingle().Which.Action.Should().Be("BAN");
    }

    // ---------- Broadcast thông báo ----------

    [Fact]
    public async Task Announce_BroadcastsEventAndWritesAudit()
    {
        var (db, owner, _, _, _, _, _, _) = await NewContextAsync();
        var notifier = new FakeNotifier();
        var handler = new AnnounceHandler(db, new FakeUser(owner.Id), new FakeClock(Now), notifier);

        var result = await handler.Handle(new AnnounceCommand("  Xin chào tất cả  "), default);

        result.Message.Should().Be("Xin chào tất cả");
        result.SenderName.Should().Be("Admin Owner");

        notifier.Broadcasts.Should().ContainSingle();
        notifier.Broadcasts[0].Event.Should().Be(EventNames.Announcement);
        var evt = notifier.Broadcasts[0].Payload.Should().BeOfType<AnnouncementEvent>().Subject;
        evt.Message.Should().Be("Xin chào tất cả");
        evt.SenderName.Should().Be("Admin Owner");

        var log = await db.AdminAuditLogs.SingleAsync(l => l.Action == "ANNOUNCE");
        log.Detail.Should().Be("Xin chào tất cả");
    }

    // ---------- Hoạt động (mọi nhóm) ----------

    [Fact]
    public async Task Activities_ReturnsAllWithJoinsAndCheckinCounts()
    {
        var (db, _, _, _, group, challenge, deadline, duration) = await NewContextAsync();
        var handler = new AdminActivitiesHandler(db);

        var result = await handler.Handle(new AdminActivitiesQuery(null, null, 1, 20), default);

        result.Total.Should().Be(2);
        result.Activities.Should().HaveCount(2);

        var row = result.Activities.Single(a => a.Id == deadline.Id.ToString());
        row.Name.Should().Be("Dậy sớm");
        row.Type.Should().Be("DEADLINE");
        row.ProofType.Should().Be("ANY");
        row.ChallengeTitle.Should().Be("Kỳ tháng 1");
        row.ChallengeStatus.Should().Be("ACTIVE");
        row.StartDate.Should().Be("2025-01-08");
        row.EndDate.Should().Be("2025-01-21");
        row.GroupName.Should().Be("Team A");
        row.OwnerName.Should().Be("Admin Owner");
        row.CheckinCount.Should().Be(1);

        var other = result.Activities.Single(a => a.Id == duration.Id.ToString());
        other.CheckinCount.Should().Be(0);
    }

    [Fact]
    public async Task Activities_FiltersBySearchAndType()
    {
        var (db, _, _, _, _, _, deadline, duration) = await NewContextAsync();
        var handler = new AdminActivitiesHandler(db);

        var byName = await handler.Handle(new AdminActivitiesQuery("dậy", null, 1, 20), default);
        byName.Total.Should().Be(1);
        byName.Activities[0].Id.Should().Be(deadline.Id.ToString());

        var byTitle = await handler.Handle(new AdminActivitiesQuery("kỳ tháng", null, 1, 20), default);
        byTitle.Total.Should().Be(2);

        var byType = await handler.Handle(new AdminActivitiesQuery(null, "duration", 1, 20), default);
        byType.Total.Should().Be(1);
        byType.Activities[0].Id.Should().Be(duration.Id.ToString());

        var byNone = await handler.Handle(new AdminActivitiesQuery("không-có", null, 1, 20), default);
        byNone.Total.Should().Be(0);
    }

    [Fact]
    public async Task Activities_FiltersByChallengeId()
    {
        var (db, _, member, _, group, challenge, deadline, _) = await NewContextAsync();
        var second = await AddChallengeAsync(db, group, member, "Kỳ phụ",
            new DateOnly(2025, 2, 1), new DateOnly(2025, 2, 14), ChallengeStatus.Draft);
        var other = new Activity
        {
            ChallengeId = second.Id,
            Name = "Chạy bộ",
            Type = ActivityType.Deadline,
            DeadlineTime = new TimeOnly(6, 0),
            SortOrder = 0
        };
        db.Activities.Add(other);
        await db.SaveChangesAsync();
        var handler = new AdminActivitiesHandler(db);

        var scoped = await handler.Handle(new AdminActivitiesQuery(null, null, 1, 20, second.Id), default);
        scoped.Total.Should().Be(1);
        scoped.Activities[0].Id.Should().Be(other.Id.ToString());

        var firstOnly = await handler.Handle(new AdminActivitiesQuery(null, null, 1, 20, challenge.Id), default);
        firstOnly.Total.Should().Be(2);
        firstOnly.Activities.Should().OnlyContain(a => a.ChallengeTitle == "Kỳ tháng 1");
        firstOnly.Activities.Should().Contain(a => a.Id == deadline.Id.ToString());
    }

    // ---------- Kỳ thử thách (mọi nhóm) ----------

    private static async Task<Challenge> AddChallengeAsync(
        AppDbContext db, Group group, User owner, string title,
        DateOnly start, DateOnly end, ChallengeStatus status)
    {
        var c = new Challenge
        {
            GroupId = group.Id,
            UserId = owner.Id,
            Title = title,
            StartDate = start,
            EndDate = end,
            Status = status,
            LockedAt = status == ChallengeStatus.Active ? Now : null,
            CreatedAt = Now
        };
        db.Challenges.Add(c);
        await db.SaveChangesAsync();
        return c;
    }

    [Fact]
    public async Task Challenges_ReturnsAllWithJoinsAndCounts()
    {
        var (db, _, member, _, group, challenge, _, _) = await NewContextAsync();
        var second = await AddChallengeAsync(db, group, member, "Kỳ phụ",
            new DateOnly(2025, 2, 1), new DateOnly(2025, 2, 14), ChallengeStatus.Draft);
        db.Activities.Add(new Activity
        {
            ChallengeId = second.Id,
            Name = "Chạy bộ",
            Type = ActivityType.Deadline,
            DeadlineTime = new TimeOnly(6, 0),
            SortOrder = 0
        });
        await db.SaveChangesAsync();
        var handler = new AdminChallengesHandler(db);

        var result = await handler.Handle(new AdminChallengesQuery(null, null, 1, 20), default);

        result.Total.Should().Be(2);
        // Sắp startDate giảm: kỳ phụ (2025-02-01) trước, kỳ tháng 1 (2025-01-08) sau.
        result.Challenges[0].Id.Should().Be(second.Id.ToString());
        result.Challenges[1].Id.Should().Be(challenge.Id.ToString());

        var row = result.Challenges.Single(c => c.Id == challenge.Id.ToString());
        row.Title.Should().Be("Kỳ tháng 1");
        row.Status.Should().Be("ACTIVE");
        row.StartDate.Should().Be("2025-01-08");
        row.EndDate.Should().Be("2025-01-21");
        row.GroupName.Should().Be("Team A");
        row.OwnerName.Should().Be("Admin Owner");
        row.ActivityCount.Should().Be(2);
        row.CheckinCount.Should().Be(1);

        var draft = result.Challenges.Single(c => c.Id == second.Id.ToString());
        draft.Status.Should().Be("DRAFT");
        draft.OwnerName.Should().Be("Thành viên");
        draft.ActivityCount.Should().Be(1);
        draft.CheckinCount.Should().Be(0);
    }

    [Fact]
    public async Task Challenges_FiltersByStatusAndSearch()
    {
        var (db, _, member, _, group, _, _, _) = await NewContextAsync();
        await AddChallengeAsync(db, group, member, "Kỳ phụ",
            new DateOnly(2025, 2, 1), new DateOnly(2025, 2, 14), ChallengeStatus.Draft);
        var handler = new AdminChallengesHandler(db);

        var active = await handler.Handle(new AdminChallengesQuery(null, "active", 1, 20), default);
        active.Total.Should().Be(1);
        active.Challenges[0].Title.Should().Be("Kỳ tháng 1");

        var draft = await handler.Handle(new AdminChallengesQuery(null, "DRAFT", 1, 20), default);
        draft.Total.Should().Be(1);
        draft.Challenges[0].Title.Should().Be("Kỳ phụ");

        var byTitle = await handler.Handle(new AdminChallengesQuery("kỳ phụ", null, 1, 20), default);
        byTitle.Total.Should().Be(1);

        var byOwner = await handler.Handle(new AdminChallengesQuery("thành viên", null, 1, 20), default);
        byOwner.Total.Should().Be(1);
        byOwner.Challenges[0].Title.Should().Be("Kỳ phụ");

        var byGroup = await handler.Handle(new AdminChallengesQuery("team a", null, 1, 20), default);
        byGroup.Total.Should().Be(2);

        var byNone = await handler.Handle(new AdminChallengesQuery("không-có", null, 1, 20), default);
        byNone.Total.Should().Be(0);
    }

    // ---------- Quỹ phạt ----------

    [Fact]
    public async Task Fund_SumsPenaltyPaidOutstandingAndListsRecentEntries()
    {
        var (db, owner, _, _, group, _, _, _) = await NewContextAsync();
        var handler = new AdminFundHandler(db);

        var result = await handler.Handle(new AdminFundQuery(), default);

        result.GrandTotalPenalty.Should().Be(20_000);
        result.GrandTotalPaid.Should().Be(10_000);
        result.GrandOutstanding.Should().Be(10_000);

        result.Groups.Should().ContainSingle();
        var g = result.Groups[0];
        g.GroupId.Should().Be(group.Id.ToString());
        g.Name.Should().Be("Team A");
        g.TotalPenalty.Should().Be(20_000);
        g.TotalPaid.Should().Be(10_000);
        g.Outstanding.Should().Be(10_000);

        result.RecentEntries.Should().HaveCount(2);
        result.RecentEntries[0].Kind.Should().Be("PENALTY"); // mới nhất trước
        result.RecentEntries[0].GroupName.Should().Be("Team A");
        result.RecentEntries[0].UserName.Should().Be("Admin Owner");
        result.RecentEntries[1].Kind.Should().Be("PAYMENT");
        result.RecentEntries[1].Amount.Should().Be(10_000);
    }

    // ---------- Thống kê mở rộng ----------

    [Fact]
    public async Task StatsOverview_BuildsTrendRankingAndTopUsers()
    {
        var (db, owner, _, _, group, _, _, _) = await NewContextAsync();
        var handler = new AdminStatsOverviewHandler(db, new FakeClock(Now));

        var result = await handler.Handle(new AdminStatsOverviewQuery(), default);

        // Xu hướng 14 ngày, cuối là hôm nay (VN), đầu là hôm nay - 13.
        result.DailyTrend.Should().HaveCount(14);
        result.DailyTrend[0].Date.Should().Be("2025-01-02");
        result.DailyTrend[^1].Date.Should().Be("2025-01-15");
        result.DailyTrend[^1].Checkins.Should().Be(1);
        result.DailyTrend[^1].PenaltyVnd.Should().Be(20_000);
        result.DailyTrend.Should().Contain(d => d.Date == "2025-01-14" && d.Checkins == 0 && d.PenaltyVnd == 0);

        // Xếp hạng nhóm: 2 ngày chốt, 1 ngày fail → đạt 50%.
        result.GroupRanking.Should().ContainSingle();
        var rank = result.GroupRanking[0];
        rank.GroupId.Should().Be(group.Id.ToString());
        rank.MemberCount.Should().Be(2);
        rank.SettledDays.Should().Be(2);
        rank.FailedDays.Should().Be(1);
        rank.TotalPenalty.Should().Be(20_000);
        rank.PassRate.Should().Be(0.5);

        // Top user phạt.
        result.TopPenaltyUsers.Should().ContainSingle();
        var top = result.TopPenaltyUsers[0];
        top.UserId.Should().Be(owner.Id.ToString());
        top.DisplayName.Should().Be("Admin Owner");
        top.TotalPenalty.Should().Be(20_000);
        top.FailedDays.Should().Be(1);
    }
}
