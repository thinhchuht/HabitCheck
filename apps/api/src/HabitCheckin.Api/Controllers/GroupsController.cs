using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

[ApiController]
[Route("api/groups")]
[Authorize]
public sealed class GroupsController(ISender sender) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<GroupDto>> Create([FromBody] CreateGroupCommand cmd, CancellationToken ct)
    {
        var group = await sender.Send(cmd, ct);
        return CreatedAtAction(nameof(Get), new { groupId = group.Id }, group);
    }

    [HttpPost("join")]
    public async Task<ActionResult<GroupDto>> Join([FromBody] JoinGroupCommand cmd, CancellationToken ct) =>
        Ok(await sender.Send(cmd, ct));

    [HttpGet("mine")]
    public async Task<ActionResult<List<GroupDto>>> Mine(CancellationToken ct) =>
        Ok(await sender.Send(new GetMyGroupsQuery(), ct));

    [HttpGet("{groupId:guid}")]
    [Authorize(Policy = "GroupMember")]
    public async Task<ActionResult<GroupDto>> Get(Guid groupId, CancellationToken ct) =>
        Ok(await sender.Send(new GetGroupQuery(groupId), ct));

    [HttpGet("{groupId:guid}/live")]
    [Authorize(Policy = "GroupMember")]
    public async Task<ActionResult<LiveBoardDto>> Live(Guid groupId, CancellationToken ct) =>
        Ok(await sender.Send(new GetGroupLiveQuery(groupId), ct));

    [HttpGet("{groupId:guid}/daily-report")]
    [Authorize(Policy = "GroupMember")]
    public async Task<ActionResult<DailyReportDto>> DailyReport(
        Guid groupId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct) =>
        Ok(await sender.Send(new GetGroupDailyReportQuery(groupId, from, to), ct));

    [HttpPatch("{groupId:guid}/penalty-tiers")]
    [Authorize(Policy = "GroupOwner")]
    public async Task<ActionResult<GroupDto>> UpdatePenaltyTiers(
        Guid groupId, [FromBody] UpdatePenaltyTiersCommand cmd, CancellationToken ct)
    {
        cmd = cmd with { GroupId = groupId };
        return Ok(await sender.Send(cmd, ct));
    }

    [HttpDelete("{groupId:guid}/members/{userId:guid}")]
    [Authorize(Policy = "GroupOwner")]
    public async Task<IActionResult> RemoveMember(Guid groupId, Guid userId, CancellationToken ct)
    {
        await sender.Send(new RemoveMemberCommand(groupId, userId), ct);
        return NoContent();
    }
}
