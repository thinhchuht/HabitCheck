namespace HabitCheckin.Domain.Enums;

public enum ActivityType
{
    Deadline,
    Duration,
    Window
}

public enum ProofType
{
    Photo,
    Video,
    Any
}

public enum ChallengeStatus
{
    Draft,
    Active,
    Completed,
    Cancelled
}

public enum CheckInStatus
{
    Open,
    Completed,
    Abandoned,
    Rejected
}

public enum ResultStatus
{
    Provisional,
    Final
}

public enum MemberRole
{
    Owner,
    Admin,
    Member
}

public enum ProofReviewAction
{
    Report,
    Approve,
    Reject
}

public enum LedgerKind
{
    Penalty,
    Payment,
    Adjustment
}

public enum UploadIntentKind
{
    CheckIn,
    CheckOut,
    Avatar
}
