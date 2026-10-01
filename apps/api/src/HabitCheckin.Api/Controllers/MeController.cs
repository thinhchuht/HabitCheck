using HabitCheckin.Application.Auth;
using HabitCheckin.Application.CheatDays;
using HabitCheckin.Application.Dtos;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class MeController(ISender sender) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct) =>
        Ok(await sender.Send(new GetMeQuery(), ct));

    [HttpPatch("me")]
    public async Task<ActionResult<UserDto>> UpdateMe([FromBody] UpdateMeCommand cmd, CancellationToken ct) =>
        Ok(await sender.Send(cmd, ct));

    [HttpPost("me/avatar/intent")]
    public async Task<ActionResult<UploadIntentDto>> AvatarIntent(CancellationToken ct) =>
        Ok(await sender.Send(new CreateAvatarIntentCommand(), ct));

    [HttpPut("me/avatar")]
    public async Task<ActionResult<UserDto>> UpdateAvatar([FromBody] UpdateAvatarCommand cmd, CancellationToken ct) =>
        Ok(await sender.Send(cmd, ct));

    // Cheat day: hôm nay hoặc 7 ngày tới, tối đa 1/tuần cho mỗi (user, nhóm)
    [HttpPost("me/cheat-days")]
    public async Task<ActionResult<CheatDayDto>> MarkCheatDay([FromBody] MarkCheatDayRequest req, CancellationToken ct) =>
        CreatedAtAction(nameof(MarkCheatDay), null, await sender.Send(new MarkCheatDayCommand(req.GroupId, req.Date), ct));

    [HttpDelete("me/cheat-days/{date}")]
    public async Task<IActionResult> UnmarkCheatDay([FromRoute] string date, [FromQuery] Guid groupId, CancellationToken ct)
    {
        await sender.Send(new UnmarkCheatDayCommand(groupId, date), ct);
        return NoContent();
    }
}

public sealed record MarkCheatDayRequest(Guid GroupId, string? Date);
