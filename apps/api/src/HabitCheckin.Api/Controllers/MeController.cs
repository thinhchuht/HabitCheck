using HabitCheckin.Application.Auth;
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
}
