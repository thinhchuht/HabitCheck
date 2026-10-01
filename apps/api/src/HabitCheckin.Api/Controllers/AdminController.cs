using HabitCheckin.Application.Admin;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Services;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

/// <summary>
/// Khu quản trị — chỉ user có quyền admin (JWT role "admin").
/// Các endpoint "job" (settle/finalize/activate) chỉ chạy ở môi trường Development.
/// Mọi thao tác quản lý đều ghi audit log (xem GET /admin/audit-logs).
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = "Admin")]
public sealed class AdminController(
    ISender sender, ISettlementService settlement, IClock clock, ICurrentUser currentUser,
    IJobStatusProvider jobs, IWebHostEnvironment env) : ControllerBase
{
    // ---------- Thống kê tổng quan ----------

    [HttpGet("stats")]
    public async Task<ActionResult<AdminStatsDto>> Stats(CancellationToken ct) =>
        Ok(await sender.Send(new AdminStatsQuery(), ct));

    [HttpGet("stats/overview")]
    public async Task<ActionResult<AdminStatsOverviewDto>> StatsOverview(CancellationToken ct) =>
        Ok(await sender.Send(new AdminStatsOverviewQuery(), ct));

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

    [HttpPost("users/{id:guid}/ban")]
    public async Task<ActionResult<UserDto>> Ban(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new BanUserCommand(id, true), ct));

    [HttpDelete("users/{id:guid}/ban")]
    public async Task<ActionResult<UserDto>> Unban(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new BanUserCommand(id, false), ct));

    [HttpPatch("users/{id:guid}")]
    public async Task<ActionResult<UserDto>> Rename(Guid id, [FromBody] RenameUserRequest body, CancellationToken ct) =>
        Ok(await sender.Send(new RenameUserCommand(id, body.DisplayName), ct));

    [HttpPost("users/{id:guid}/password")]
    public async Task<IActionResult> SetPassword(Guid id, [FromBody] SetUserPasswordRequest body, CancellationToken ct)
    {
        await sender.Send(new SetUserPasswordCommand(id, body.NewPassword), ct);
        return NoContent();
    }

    // ---------- Groups ----------

    [HttpGet("groups")]
    public async Task<ActionResult<AdminGroupListDto>> Groups(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new AdminGroupsQuery(page, pageSize), ct));

    [HttpGet("groups/{id:guid}")]
    public async Task<ActionResult<AdminGroupDetailDto>> GroupDetail(Guid id, CancellationToken ct) =>
        Ok(await sender.Send(new AdminGroupDetailQuery(id), ct));

    // ---------- Kỳ thử thách + hoạt động (mọi nhóm) ----------

    [HttpGet("challenges")]
    public async Task<ActionResult<AdminChallengeListDto>> Challenges(
        [FromQuery] string? search, [FromQuery] string? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new AdminChallengesQuery(search, status, page, pageSize), ct));

    [HttpGet("activities")]
    public async Task<ActionResult<AdminActivityListDto>> Activities(
        [FromQuery] string? search, [FromQuery] string? type,
        [FromQuery] Guid? challengeId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await sender.Send(new AdminActivitiesQuery(search, type, page, pageSize, challengeId), ct));

    // ---------- Quỹ phạt toàn hệ thống ----------

    [HttpGet("fund")]
    public async Task<ActionResult<AdminFundDto>> Fund(CancellationToken ct) =>
        Ok(await sender.Send(new AdminFundQuery(), ct));

    // ---------- Vận hành ----------

    [HttpGet("jobs")]
    public async Task<ActionResult<IReadOnlyList<JobStatusInfo>>> Jobs(CancellationToken ct) =>
        Ok(await jobs.GetJobsAsync(ct));

    [HttpGet("audit-logs")]
    public async Task<ActionResult<AdminAuditLogListDto>> AuditLogs(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 30, CancellationToken ct = default) =>
        Ok(await sender.Send(new AuditLogsQuery(page, pageSize), ct));

    [HttpPost("announce")]
    public async Task<ActionResult<AnnounceResultDto>> Announce([FromBody] AnnounceRequest body, CancellationToken ct) =>
        Ok(await sender.Send(new AnnounceCommand(body.Message), ct));

    // ---------- Chạy job theo ngày (chỉ Development) ----------

    [HttpPost("settle")]
    public async Task<IActionResult> Settle([FromQuery] string? date, CancellationToken ct)
    {
        if (!env.IsDevelopment()) return Forbid();
        var d = ParseDate(date);
        await settlement.SettleDayAsync(d, closeOpenSessions: true, ct);
        await sender.Send(new LogAdminAuditCommand(currentUser.Id, "SETTLE", null, null,
            $"Chạy settle cho ngày {d:yyyy-MM-dd} (kết quả PROVISIONAL)"), ct);
        return Ok(new { date = d.ToString("yyyy-MM-dd"), status = "PROVISIONAL" });
    }

    [HttpPost("finalize")]
    public async Task<IActionResult> Finalize([FromQuery] string? date, CancellationToken ct)
    {
        if (!env.IsDevelopment()) return Forbid();
        var d = ParseDate(date);
        await settlement.FinalizeDayAsync(d, ct);
        await sender.Send(new LogAdminAuditCommand(currentUser.Id, "FINALIZE", null, null,
            $"Chạy finalize cho ngày {d:yyyy-MM-dd} (chốt FINAL + ghi quỹ)"), ct);
        return Ok(new { date = d.ToString("yyyy-MM-dd"), status = "FINAL" });
    }

    [HttpPost("activate")]
    public async Task<IActionResult> Activate(CancellationToken ct)
    {
        if (!env.IsDevelopment()) return Forbid();
        await settlement.ActivateChallengesAsync(ct);
        await sender.Send(new LogAdminAuditCommand(currentUser.Id, "ACTIVATE", null, null,
            "Chạy kích hoạt challenge (DRAFT→ACTIVE)"), ct);
        return Ok(new { status = "OK" });
    }

    private DateOnly ParseDate(string? date) =>
        string.IsNullOrWhiteSpace(date) || !DateOnly.TryParse(date, out var d)
            ? clock.TodayLocal
            : d;
}

public sealed record RenameUserRequest(string DisplayName);
public sealed record SetUserPasswordRequest(string NewPassword);
public sealed record AnnounceRequest(string Message);
