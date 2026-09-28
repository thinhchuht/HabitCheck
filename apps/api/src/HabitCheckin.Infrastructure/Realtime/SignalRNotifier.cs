using HabitCheckin.Application.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace HabitCheckin.Infrastructure.Realtime;

public sealed class SignalRNotifier(IHubContext<LiveHub> hub) : IRealtimeNotifier
{
    public Task GroupAsync(Guid groupId, string eventName, object payload, CancellationToken ct = default) =>
        hub.Clients.Group($"group:{groupId:N}").SendAsync(eventName, payload, ct);

    public Task UserAsync(Guid userId, string eventName, object payload, CancellationToken ct = default) =>
        hub.Clients.Group($"user:{userId:N}").SendAsync(eventName, payload, ct);
}
