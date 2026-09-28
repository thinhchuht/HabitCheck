using HabitCheckin.Application.CheckIns;
using HabitCheckin.Application.Dtos;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HabitCheckin.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class CheckInsController(ISender sender) : ControllerBase
{
    [HttpGet("today")]
    public async Task<ActionResult<TodayDto>> Today([FromQuery] Guid groupId, CancellationToken ct) =>
        Ok(await sender.Send(new GetTodayQuery(groupId), ct));

    [HttpPost("uploads/intent")]
    [EnableRateLimiting("intent-user")]
    public async Task<ActionResult<UploadIntentDto>> UploadIntent(
        [FromBody] UploadIntentRequest req, CancellationToken ct) =>
        Ok(await sender.Send(new CreateUploadIntentCommand(req.ActivityId, req.Kind), ct));

    [HttpPost("checkins")]
    public async Task<ActionResult<CheckInDto>> CheckIn([FromBody] CheckInCommand cmd, CancellationToken ct)
    {
        var checkin = await sender.Send(cmd, ct);
        return CreatedAtAction(nameof(History), new { }, checkin);
    }

    [HttpPost("checkins/{checkinId:guid}/checkout")]
    public async Task<ActionResult<CheckInDto>> CheckOut(
        Guid checkinId, [FromBody] CheckoutRequest req, CancellationToken ct) =>
        Ok(await sender.Send(new CheckOutCommand(checkinId, req.IntentId, req.PublicId), ct));

    [HttpGet("checkins")]
    public async Task<ActionResult<List<CheckInDto>>> History(
        [FromQuery] Guid? userId, [FromQuery] string? date, [FromQuery] Guid? activityId, CancellationToken ct) =>
        Ok(await sender.Send(new GetCheckInsCommand(
            userId?.ToString(), date, activityId), ct));
}

public sealed record UploadIntentRequest(Guid ActivityId, string Kind);
public sealed record CheckoutRequest(Guid IntentId, string PublicId);
