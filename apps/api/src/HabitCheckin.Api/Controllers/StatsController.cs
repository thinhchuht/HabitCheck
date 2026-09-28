using HabitCheckin.Application.Dtos;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class StatsController(ISender sender) : ControllerBase
{
    [HttpGet("stats/me")]
    public async Task<ActionResult<PersonalStatsDto>> Me(
        [FromQuery] string? from, [FromQuery] string? to, CancellationToken ct) =>
        Ok(await sender.Send(new GetUserStatsCommand(from, to), ct));

    [HttpGet("stats/me/heatmap")]
    public async Task<ActionResult<HeatmapDto>> Heatmap([FromQuery] int? year, CancellationToken ct) =>
        Ok(await sender.Send(new GetHeatmapCommand(year), ct));

    [HttpGet("groups/{groupId:guid}/leaderboard")]
    [Authorize(Policy = "GroupMember")]
    public async Task<ActionResult<List<LeaderboardRowDto>>> Leaderboard(
        Guid groupId, [FromQuery] string? from, [FromQuery] string? to, CancellationToken ct) =>
        Ok(await sender.Send(new GetLeaderboardCommand(groupId, from, to), ct));
}
