namespace HabitCheckin.Application.Abstractions;

public interface IPresenceTracker
{
    /// <summary>Báo connection mới; trả về userId có chuyển trạng thái offline→online trong nhóm.</summary>
    Guid? ConnectionAdded(Guid groupId, Guid userId, string connectionId);

    /// <summary>Báo connection thoát; trả về userId có chuyển trạng thái online→offline trong nhóm.</summary>
    Guid? ConnectionRemoved(string connectionId);

    ISet<Guid> GetOnlineUsers(Guid groupId);
}
