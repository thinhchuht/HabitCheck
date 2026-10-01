using HabitCheckin.Application.Admin;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Services;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

/// <summary>
/// Khu quản trị — chỉ user có quyền admin (JWT role "admin").
/// Các endpoint "job" (settle/finalize/activate) chỉ chạy ở môi trường Development.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = "Admin")]
public sealed class AdminController(ISender sender, ISettlementService settlement, IClock clock, IWebHostEnvironment env) : ControllerBase
{
    // ---------- Thống kê tổng quan ----------

    [HttpGet("stats")]
    public async Task<ActionResult<AdminStatsDto>> Stats(CancellationToken ct) =>
        Ok(await sender.Send(new AdminStatsQuery(), ct));

    // ---------- Users ----------

    [HttpGet("users")]
    public async Task<ActionResult<AdminUserListDto>> Users(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new AdminUsersQuery(search, page, pageSize), ct));

    [HttpGet("users/{id:guid}")]
    public async Task<ActionResult<AdminUserDetailDto>> UserDetail(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new AdminUserDetailQuery(id), ct));

    [HttpPost("users/{id:guid}/admin")]
    public async Task<ActionResult> MakeAdmin(Guid id, CancellationToken ct)
    {
        await sender.Send(new SetUserAdminCommand(id, true), ct);
        return NoContent();
    }

    [HttpDelete("users/{id:guid}/admin")]
    public async Task<ActionResult> RevokeAdmin(Guid id, CancellationToken ct)
    {
        await sender.Send(new SetUserAdminCommand(id, false), ct);
        return NoContent();
    }

    // ---------- Groups ----------

    [HttpGet("groups")]
    public async Task<ActionResult<AdminGroupListDto>> Groups(CancellationToken ct) =>
        Ok(await sender.Send(new AdminGroupsQuery(), ct));

    [HttpGet("groups/{id:guid}")]
    public async Task<ActionResult<AdminGroupDetailDto>> GroupDetail(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new AdminGroupDetailQuery(id), ct));

    // ---------- Chạy job theo ngày (chỉ Development) ----------

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
