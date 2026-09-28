using HabitCheckin.Domain.Enums;
using MediatR;

namespace HabitCheckin.Application.Dtos;

public sealed record FundDebtDto(string UserId, string DisplayName, string? AvatarUrl, long TotalPenalty, long TotalPaid, long Balance);

public sealed record FundHistoryDto(
    string Id,
    string UserId,
    string DisplayName,
    long Amount,
    LedgerKind Kind,
    string? Note,
    string? RefDate,
    string? CreatedBy,
    string CreatedAt);

public sealed record FundDto(
    string GroupId,
    long TotalPenalty,
    long TotalPaid,
    long TotalOutstanding,
    List<FundDebtDto> Debts,
    List<FundHistoryDto> History);

public sealed record RecordPaymentCommand(Guid GroupId, Guid UserId, long Amount, string? Note)
    : IRequest<LedgerEntryDto>;
public sealed record LedgerEntryDto(string Id, long Amount, LedgerKind Kind, string? Note, string CreatedAt);
