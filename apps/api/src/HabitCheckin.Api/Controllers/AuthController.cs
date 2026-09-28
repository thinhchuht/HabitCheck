using HabitCheckin.Application.Auth;
using HabitCheckin.Application.Dtos;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(ISender sender, IWebHostEnvironment env) : ControllerBase
{
    private const string RefreshCookie = "hc_refresh";
    private static readonly TimeSpan RefreshLifetime = TimeSpan.FromDays(30);

    [HttpPost("google")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Google([FromBody] GoogleLoginRequest request, CancellationToken ct)
    {
        var result = await sender.Send(new GoogleLoginCommand(request.IdToken), ct);
        SetRefreshCookie(result.RefreshTokenValue);
        return Ok(new AuthResponse(result.User, result.AccessToken, result.AccessExpiresIn));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken ct)
    {
        var result = await sender.Send(new RefreshTokenCommand(Request.Cookies[RefreshCookie]), ct);
        SetRefreshCookie(result.RefreshTokenValue);
        return Ok(new AuthResponse(result.User, result.AccessToken, result.AccessExpiresIn));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await sender.Send(new LogoutCommand(Request.Cookies[RefreshCookie]), ct);
        Response.Cookies.Delete(RefreshCookie, CookieOptions);
        return NoContent();
    }

    private void SetRefreshCookie(string token)
    {
        Response.Cookies.Append(RefreshCookie, token, CookieOptions);
    }

    private CookieOptions CookieOptions => new()
    {
        HttpOnly = true,
        Secure = env.IsProduction(),
        SameSite = SameSiteMode.Strict,
        Path = "/api/auth",
        MaxAge = RefreshLifetime
    };
}

public sealed record GoogleLoginRequest(string IdToken);
public sealed record AuthResponse(UserDto User, string AccessToken, int AccessExpiresIn);
