using System.Collections.Concurrent;
using HabitCheckin.Application.Abstractions;

namespace HabitCheckin.Infrastructure.Realtime;

/// <summary>
/// Theo dõi connection đang join từng nhóm để biết ai online.
/// Mỗi user "online" nếu có ≥ 1 connection đang join nhóm.
/// </summary>
public sealed class PresenceTracker : IPresenceTracker
{
    // groupId(N) -> userId -> số connection
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, int>> _groups = new();
    // connectionId -> (groupId, userId)
    private readonly ConcurrentDictionary<string, (Guid GroupId, Guid UserId)> _connections = new();

    public Guid? ConnectionAdded(Guid groupId, Guid userId, string connectionId)
    {
        var group = _groups.GetOrAdd(GroupIdKey(groupId), _ => new ConcurrentDictionary<Guid, int>());
        var firstConnection = group.AddOrUpdate(userId, 1, (_, n) => n + 1) == 1;
        _connections[connectionId] = (groupId, userId);
        return firstConnection ? userId : null;
    }

    public Guid? ConnectionRemoved(string connectionId)
    {
        if (!_connections.TryRemove(connectionId, out var info)) return null;
        var key = GroupIdKey(info.GroupId);
        if (!_groups.TryGetValue(key, out var group)) return null;

        int newCount = group.AddOrUpdate(info.UserId, 1, (_, n) => n - 1);
        if (newCount <= 0)
        {
            group.TryRemove(info.UserId, out _);
            return info.UserId;
        }
        return null;
    }

    public ISet<Guid> GetOnlineUsers(Guid groupId)
    {
        if (_groups.TryGetValue(GroupIdKey(groupId), out var group))
            return new HashSet<Guid>(group.Keys);
        return new HashSet<Guid>();
    }

    private static string GroupIdKey(Guid groupId) => groupId.ToString("N");
}
