using HabitCheckin.Application.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Infrastructure.Realtime;

/// <summary>
/// Hub realtime nhóm. Xác thực JWT (kể cả qua query access_token) ở tầng middleware;
/// hub chỉ cần [Authorize] + kiểm tra quyền thành viên khi JoinGroup.
/// </summary>
[Authorize]
public sealed class LiveHub(
    IAppDbContext db,
    ICurrentUser user,
    IPresenceTracker presence,
    IRealtimeNotifier notifier) : Hub
{
    public async Task<JoinResult> JoinGroup(Guid groupId)
    {
        var isMember = await db.GroupMembers
            .AsNoTracking()
            .AnyAsync(m => m.GroupId == groupId && m.UserId == user.Id, CancellationToken.None);
        if (!isMember)
            throw new HubException("Bạn không phải thành viên của nhóm");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(groupId));
        await Groups.AddToGroupAsync(Context.ConnectionId, UserName(user.Id));

        var cameOnline = presence.ConnectionAdded(groupId, user.Id, Context.ConnectionId);
        if (cameOnline is not null)
            await notifier.GroupAsync(groupId, EventNames.MemberPresence,
                new MemberPresenceEvent(cameOnline.Value.ToString(), true), CancellationToken.None);

        return new JoinResult(groupId, true);
    }

    public async Task LeaveGroup(Guid groupId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(groupId));
        var wentOffline = presence.ConnectionRemoved(Context.ConnectionId);
        if (wentOffline is not null)
            await notifier.GroupAsync(groupId, EventNames.MemberPresence,
                new MemberPresenceEvent(wentOffline.Value.ToString(), false), CancellationToken.None);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var wentOffline = presence.ConnectionRemoved(Context.ConnectionId);
        if (wentOffline is not null)
        {
            // Không biết user thoát khỏi nhóm nào cụ thể nếu join nhiều nhóm —
            // presence.ConnectionRemoved đã trả user; broadcast cho các nhóm user tham gia.
            var groupIds = await db.GroupMembers.AsNoTracking()
                .Where(m => m.UserId == wentOffline.Value)
                .Select(m => m.GroupId)
                .ToListAsync(CancellationToken.None);
            foreach (var gid in groupIds)
                await notifier.GroupAsync(gid, EventNames.MemberPresence,
                    new MemberPresenceEvent(wentOffline.Value.ToString(), false), CancellationToken.None);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private static string GroupName(Guid groupId) => $"group:{groupId:N}";
    private static string UserName(Guid userId) => $"user:{userId:N}";

    public sealed record JoinResult(Guid GroupId, bool Joined);
}
