using HabitCheckin.Application.Challenges;
using HabitCheckin.Application.Dtos;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

[ApiController]
[Route("api/challenges")]
[Authorize]
public sealed class ChallengesController(ISender sender) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ChallengeDto>> Create([FromBody] CreateChallengeCommand cmd, CancellationToken ct)
    {
        var challenge = await sender.Send(cmd, ct);
        return CreatedAtAction(nameof(Get), new { challengeId = challenge.Id }, challenge);
    }

    [HttpGet("mine")]
    public async Task<ActionResult<List<ChallengeDto>>> Mine([FromQuery] Guid groupId, CancellationToken ct) =>
        Ok(await sender.Send(new GetMyChallengesQuery(groupId), ct));

    [HttpGet("group/{groupId:guid}")]
    public async Task<ActionResult<List<ChallengeDto>>> InGroup(Guid groupId, CancellationToken ct) =>
        Ok(await sender.Send(new GetGroupChallengesQuery(groupId), ct));

    [HttpGet("{challengeId:guid}")]
    public async Task<ActionResult<ChallengeDto>> Get(Guid challengeId, CancellationToken ct) =>
        Ok(await sender.Send(new GetChallengeQuery(challengeId), ct));

    [HttpPatch("{challengeId:guid}")]
    [Authorize(Policy = "ChallengeOwner")]
    public async Task<ActionResult<ChallengeDto>> Update(
        Guid challengeId, [FromBody] UpdateChallengeRequest req, CancellationToken ct)
    {
        var cmd = new UpdateChallengeCommand(challengeId, req.Title, req.StartDate, req.EndDate);
        return Ok(await sender.Send(cmd, ct));
    }

    [HttpDelete("{challengeId:guid}")]
    [Authorize(Policy = "ChallengeOwner")]
    public async Task<IActionResult> Delete(Guid challengeId, CancellationToken ct)
    {
        await sender.Send(new DeleteChallengeCommand(challengeId), ct);
        return NoContent();
    }

    // ---------- Activities (chỉ DRAFT) ----------

    [HttpPost("{challengeId:guid}/activities")]
    [Authorize(Policy = "ChallengeOwner")]
    public async Task<ActionResult<ActivityDto>> AddActivity(
        Guid challengeId, [FromBody] ActivityInput input, CancellationToken ct)
    {
        var activity = await sender.Send(new AddActivityCommand(challengeId, input), ct);
        return CreatedAtAction(nameof(Get), new { challengeId }, activity);
    }

    [HttpPut("{challengeId:guid}/activities/{activityId:guid}")]
    [Authorize(Policy = "ChallengeOwner")]
    public async Task<ActionResult<ActivityDto>> UpdateActivity(
        Guid challengeId, Guid activityId, [FromBody] ActivityInput input, CancellationToken ct) =>
        Ok(await sender.Send(new UpdateActivityCommand(challengeId, activityId, input), ct));

    [HttpDelete("{challengeId:guid}/activities/{activityId:guid}")]
    [Authorize(Policy = "ChallengeOwner")]
    public async Task<IActionResult> DeleteActivity(Guid challengeId, Guid activityId, CancellationToken ct)
    {
        await sender.Send(new DeleteActivityCommand(challengeId, activityId), ct);
        return NoContent();
    }

    [HttpPut("{challengeId:guid}/activities/order")]
    [Authorize(Policy = "ChallengeOwner")]
    public async Task<ActionResult<List<ActivityDto>>> Reorder(
        Guid challengeId, [FromBody] ReorderRequest req, CancellationToken ct) =>
        Ok(await sender.Send(new ReorderActivitiesCommand(challengeId, req.ActivityIds), ct));
}

public sealed record UpdateChallengeRequest(string? Title, string? StartDate, string? EndDate);
public sealed record ReorderRequest(List<Guid> ActivityIds);
