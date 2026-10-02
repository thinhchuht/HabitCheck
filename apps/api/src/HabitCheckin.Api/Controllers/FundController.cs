using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Fund;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitCheckin.Api.Controllers;

[ApiController]
[Route("api/groups/{groupId:guid}/fund")]
[Authorize]
public sealed class FundController(ISender sender) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "GroupMember")]
    public async Task<ActionResult<FundDto>> Get(
        Guid groupId, CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 10) =>
        Ok(await sender.Send(new GetFundQuery(groupId, page, pageSize), ct));

    [HttpGet("history")]
    [Authorize(Policy = "GroupMember")]
    public async Task<ActionResult<FundHistoryPageDto>> History(
        Guid groupId, CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
        Ok(await sender.Send(new GetFundHistoryQuery(groupId, page, pageSize), ct));

    [HttpPost("payments")]
    [Authorize(Policy = "GroupOwner")]
    public async Task<ActionResult<LedgerEntryDto>> RecordPayment(
        Guid groupId, [FromBody] PaymentRequest req, CancellationToken ct) =>
        Ok(await sender.Send(new RecordPaymentCommand(groupId, req.UserId, req.Amount, req.Note), ct));
}

public sealed record PaymentRequest(Guid UserId, long Amount, string? Note);
