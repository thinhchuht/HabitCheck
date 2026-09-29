using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Reviews;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class ReviewsController(ISender sender) : ControllerBase
{
    [HttpGet("groups/{groupId:guid}/proofs")]
    [Authorize(Policy = "GroupMember")]
    public async Task<ActionResult<ProofFeedDto>> Proofs(
        Guid groupId, [FromQuery] string? date, [FromQuery] string? status,
        [FromQuery] string? userId, CancellationToken ct) =>
        Ok(await sender.Send(new GetProofFeedQuery(groupId, date, status, userId), ct));

    [HttpPost("checkins/{checkinId:guid}/report")]
    public async Task<IActionResult> Report(Guid checkinId, [FromBody] ReportProofRequest req, CancellationToken ct)
    {
        await sender.Send(new ReportProofCommand(checkinId, req.Reason), ct);
        return NoContent();
    }

    [HttpPost("checkins/{checkinId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid checkinId, [FromBody] ReviewRequest? req, CancellationToken ct)
    {
        await sender.Send(new ApproveProofCommand(checkinId, req?.Reason), ct);
        return NoContent();
    }

    [HttpPost("checkins/{checkinId:guid}/reject")]
    public async Task<IActionResult> Reject(Guid checkinId, [FromBody] ReviewRequest? req, CancellationToken ct)
    {
        await sender.Send(new RejectProofCommand(checkinId, req?.Reason ?? "Bị từ chối"), ct);
        return NoContent();
    }
}

public sealed record ReportProofRequest(string Reason);
public sealed record ReviewRequest(string? Reason);
