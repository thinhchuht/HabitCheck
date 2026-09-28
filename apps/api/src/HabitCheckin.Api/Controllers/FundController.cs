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
    public async Task<ActionResult<FundDto>> Get(Guid groupId, CancellationToken ct) =>
        Ok(await sender.Send(new GetFundQuery(groupId), ct));

    [HttpPost("payments")]
    [Authorize(Policy = "GroupOwner")]
    public async Task<ActionResult<LedgerEntryDto>> RecordPayment(
        Guid groupId, [FromBody] PaymentRequest req, CancellationToken ct) =>
        Ok(await sender.Send(new RecordPaymentCommand(groupId, req.UserId, req.Amount, req.Note), ct));
}

public sealed record PaymentRequest(Guid UserId, long Amount, string? Note);
