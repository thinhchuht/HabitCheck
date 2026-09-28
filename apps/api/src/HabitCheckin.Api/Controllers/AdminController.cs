using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

/// <summary>
/// Endpoint admin chỉ chạy ở môi trường Development — chạy lại job chốt cho 1 ngày cụ thể.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize]
public sealed class AdminController(ISettlementService settlement, IClock clock, IWebHostEnvironment env) : ControllerBase
{
    [HttpPost("settle")]
    public async Task<IActionResult> Settle([FromQuery] string? date, CancellationToken ct)
    {
        if (!env.IsDevelopment()) return Forbid();
        var d = ParseDate(date);
        await settlement.SettleDayAsync(d, closeOpenSessions: true, ct);
        return Ok(new { date = d.ToString("yyyy-MM-dd"), status = "PROVISIONAL" });
    }

    [HttpPost("finalize")]
    public async Task<IActionResult> Finalize([FromQuery] string? date, CancellationToken ct)
    {
        if (!env.IsDevelopment()) return Forbid();
        var d = ParseDate(date);
        await settlement.FinalizeDayAsync(d, ct);
        return Ok(new { date = d.ToString("yyyy-MM-dd"), status = "FINAL" });
    }

    [HttpPost("activate")]
    public async Task<IActionResult> Activate(CancellationToken ct)
    {
        if (!env.IsDevelopment()) return Forbid();
        await settlement.ActivateChallengesAsync(ct);
        return Ok(new { status = "OK" });
    }

    private DateOnly ParseDate(string? date) =>
        string.IsNullOrWhiteSpace(date) || !DateOnly.TryParse(date, out var d)
            ? clock.TodayLocal
            : d;
}
